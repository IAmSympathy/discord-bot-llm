/**
 * Nexa - Bot Discord de musique YouTube
 * Fonctionne dans le même processus Node que Netricsa et Klodovik.
 *
 * Fonctionnement :
 *  - Surveille le salon dédié (NEXA_MUSIC_CHANNEL_ID)
 *  - Quand un utilisateur écrit un titre / URL → recherche YouTube → propose le résultat
 *  - Un message "component v2" persistant sert de panneau de contrôle (play/pause/skip/stop/loop/queue)
 *  - Aucune commande slash
 */

import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ContainerBuilder, Events, GatewayIntentBits, Message, MessageFlags, SectionBuilder, SeparatorBuilder, TextChannel, TextDisplayBuilder, ThumbnailBuilder,} from "discord.js";
import * as dotenv from "dotenv";
import {clearQueue, deleteQueue, enqueue, getCurrentTrack, getOrCreateQueue, getQueue, GuildQueue,} from "./musicQueue";
import {joinVoice, leaveVoice, playCurrentTrack, searchYouTube, setCallbacks, skipTrack, stopPlayback, togglePause,} from "./musicPlayer";
import {buildNexaMessageOptions} from "./nexaComponents";

dotenv.config();

export class NexaBot {
    public client: Client;
    private ready = false;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers,
            ],
        });
        this.setupEventHandlers();
    }

    public async start(): Promise<void> {
        const token = process.env.NEXA_TOKEN;
        if (!token) {
            console.error("[Nexa] NEXA_TOKEN manquant dans .env — bot désactivé");
            return;
        }
        try {
            await this.client.login(token);
        } catch (error) {
            console.error("[Nexa] Erreur de connexion:", error);
        }
    }

    public async stop(): Promise<void> {
        console.log("[Nexa] Arrêt...");
        await this.client.destroy();
    }

    public isReady(): boolean {
        return this.ready;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    /** Met à jour (ou crée) le message de contrôle dans le salon dédié */
    public async refreshControlPanel(guildId: string): Promise<void> {
        const musicChannelId = process.env.NEXA_MUSIC_CHANNEL_ID;
        if (!musicChannelId) return;

        const channel = this.client.channels.cache.get(musicChannelId) as TextChannel | undefined;
        if (!channel) return;

        const q = getQueue(guildId);
        const currentTrack = q ? getCurrentTrack(guildId) : null;
        const options = buildNexaMessageOptions(q ?? {
            guildId: guildId ?? "",
            voiceChannelId: "",
            textChannelId: musicChannelId,
            tracks: [],
            currentIndex: 0,
            loop: "none",
            isPaused: false,
            controlMessageId: null,
            volume: 0.8,
        } as any, currentTrack);

        try {
            // Essayer d'éditer le message existant
            if (q?.controlMessageId) {
                const existing = await channel.messages.fetch(q.controlMessageId).catch(() => null);
                if (existing) {
                    await existing.edit(options as any);
                    return;
                }
            }

            // Sinon créer un nouveau
            await this.createControlPanel(channel, guildId, options);
        } catch (error) {
            console.error("[Nexa] Erreur lors de la mise à jour du panneau:", error);
            await this.createControlPanel(channel, guildId, options);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RECHERCHE ET PROPOSITION
    // ─────────────────────────────────────────────────────────────────────────

    private setupEventHandlers(): void {
        // ── Ready
        this.client.once(Events.ClientReady, async (c) => {
            console.log(`[Nexa] ✓ Bot connecté: ${c.user.tag}`);
            this.ready = true;

            // Callbacks du player audio
            setCallbacks(
                async (guildId) => {
                    await this.refreshControlPanel(guildId);
                },
                async (guildId, error) => {
                    console.error(`[Nexa] Erreur audio:`, error);
                    await this.refreshControlPanel(guildId);
                }
            );

            // Remettre le panneau de contrôle à jour pour chaque guilde configurée
            // (au cas où le bot redémarre)
            await this.restoreControlPanels();
        });

        // ── Réception des messages dans le salon dédié
        this.client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot) return;
            const musicChannelId = process.env.NEXA_MUSIC_CHANNEL_ID;
            if (!musicChannelId || message.channelId !== musicChannelId) return;

            await this.handleSearchRequest(message);
        });

        // ── Boutons (interactions)
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;
            if (!interaction.customId.startsWith("nexa_")) return;

            await interaction.deferUpdate().catch(() => {
            });
            await this.handleButtonInteraction(interaction);
        });

        // ── Départ du vocal : si plus personne → pause auto-stop après 5 min
        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            const guildId = oldState.guild.id;
            const q = getQueue(guildId);
            if (!q) return;

            const voiceChannel = oldState.guild.channels.cache.get(q.voiceChannelId);
            if (!voiceChannel?.isVoiceBased()) return;

            const humans = voiceChannel.members.filter(m => !m.user.bot);
            if (humans.size === 0) {
                console.log(`[Nexa] Salon vide, arrêt dans 5 min si personne ne revient…`);
                setTimeout(async () => {
                    const vc = oldState.guild.channels.cache.get(q.voiceChannelId);
                    if (!vc?.isVoiceBased()) return;
                    const stillEmpty = vc.members.filter(m => !m.user.bot).size === 0;
                    if (stillEmpty) {
                        stopPlayback(guildId);
                        leaveVoice(guildId);
                        clearQueue(guildId, false);
                        deleteQueue(guildId);
                        await this.refreshControlPanel(guildId);
                    }
                }, 5 * 60 * 1000);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GESTION DES BOUTONS
    // ─────────────────────────────────────────────────────────────────────────

    private async handleSearchRequest(message: Message): Promise<void> {
        const query = message.content.trim();
        if (!query) return;

        // Supprimer le message utilisateur pour garder le salon propre
        await message.delete().catch(() => {
        });

        // Indicateur de recherche temporaire
        const textChan = message.channel as TextChannel;
        const loadingMsg = await textChan.send({
            content: `🔍 Recherche de **${query}**...`,
        }).catch(() => null);

        const track = await searchYouTube(query);

        // Supprimer le message de chargement
        if (loadingMsg) await loadingMsg.delete().catch(() => {
        });

        if (!track) {
            const errMsg = await textChan.send({
                content: `❌ Aucun résultat trouvé pour **${query}**`,
            }).catch(() => null);
            if (errMsg) setTimeout(() => errMsg.delete().catch(() => {
            }), 5000);
            return;
        }

        // Remplir les infos de l'auteur
        const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
        track.requestedBy = member?.displayName ?? message.author.displayName;
        track.requestedById = message.author.id;

        // Construire le message de proposition avec 2 boutons
        const container = new ContainerBuilder();

        const proposalSection = new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🎵 Résultat trouvé\n**[${track.title}](${track.url})**\n-# 📺 ${track.channelName}${track.isLive ? " · 🔴 LIVE" : ` · ⏱️ ${track.durationFormatted}`}`
            )
        );

        if (track.thumbnail) {
            proposalSection.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(track.thumbnail)
            );
        }

        container.addSectionComponents(proposalSection);
        container.addSeparatorComponents(new SeparatorBuilder());

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`nexa_confirm_${message.author.id}`)
                .setLabel("▶️ Ajouter à la file")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`nexa_cancel_${message.author.id}`)
                .setLabel("✖ Annuler")
                .setStyle(ButtonStyle.Secondary)
        );

        container.addActionRowComponents(row);

        // Sauvegarder temporairement le track dans le client (5 min TTL)
        const pendingKey = `nexa_pending_${message.author.id}`;
        (this.client as any)[pendingKey] = {track, guildId: message.guild!.id, textChannelId: message.channelId};
        setTimeout(() => {
            delete (this.client as any)[pendingKey];
        }, 5 * 60 * 1000);

        const proposalMsg = await (message.channel as TextChannel).send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);

        // Auto-supprimer la proposition après 5 min si pas de réponse
        if (proposalMsg) {
            setTimeout(() => proposalMsg.delete().catch(() => {
            }), 5 * 60 * 1000);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIQUE D'AJOUT / LECTURE
    // ─────────────────────────────────────────────────────────────────────────

    private async handleButtonInteraction(interaction: any): Promise<void> {
        const customId: string = interaction.customId;
        const guildId: string = interaction.guildId;

        // ── Confirmation d'ajout
        if (customId.startsWith("nexa_confirm_")) {
            const userId = customId.replace("nexa_confirm_", "");
            if (interaction.user.id !== userId) {
                // Seul l'auteur peut confirmer
                return;
            }
            const pendingKey = `nexa_pending_${userId}`;
            const pending = (this.client as any)[pendingKey];
            if (!pending) return;

            delete (this.client as any)[pendingKey];
            await interaction.message.delete().catch(() => {
            });

            await this.addTrackAndPlay(guildId, pending.track, pending.textChannelId, interaction);
            return;
        }

        // ── Annulation
        if (customId.startsWith("nexa_cancel_")) {
            const userId = customId.replace("nexa_cancel_", "");
            if (interaction.user.id !== userId) return;
            delete (this.client as any)[`nexa_pending_${userId}`];
            await interaction.message.delete().catch(() => {
            });
            return;
        }

        // ── Contrôles principaux (nécessitent une file active)
        const q = getQueue(guildId);
        if (!q) return;

        switch (customId) {
            case "nexa_playpause": {
                const result = togglePause(guildId);
                if (result !== "no_player") await this.refreshControlPanel(guildId);
                break;
            }
            case "nexa_skip": {
                skipTrack(guildId);
                // La mise à jour du panel se fait via le callback onTrackEnd
                break;
            }
            case "nexa_prev": {
                // Revenir au track précédent
                if (q.currentIndex > 0) {
                    q.currentIndex -= 2; // -2 car advanceQueue va faire +1
                    skipTrack(guildId);
                }
                break;
            }
            case "nexa_stop": {
                stopPlayback(guildId);
                leaveVoice(guildId);
                clearQueue(guildId, false);
                deleteQueue(guildId);
                await this.refreshControlPanel(guildId);
                break;
            }
            case "nexa_loop": {
                // Cycle : none → track → queue → none
                const cycle: GuildQueue["loop"][] = ["none", "track", "queue"];
                const currentIdx = cycle.indexOf(q.loop);
                q.loop = cycle[(currentIdx + 1) % cycle.length];
                await this.refreshControlPanel(guildId);
                break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PANNEAU DE CONTRÔLE PERSISTANT
    // ─────────────────────────────────────────────────────────────────────────

    private async addTrackAndPlay(
        guildId: string,
        track: any,
        textChannelId: string,
        interaction: any
    ): Promise<void> {
        // Trouver le salon vocal de l'utilisateur
        const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            const channel = this.client.channels.cache.get(textChannelId) as TextChannel;
            const msg = await channel?.send({
                content: `❌ <@${interaction.user.id}> Tu dois être dans un salon vocal pour ajouter une musique !`,
            }).catch(() => null);
            if (msg) setTimeout(() => msg.delete().catch(() => {
            }), 5000);
            return;
        }

        // Créer / récupérer la file
        const q = getOrCreateQueue(guildId, voiceChannel.id, textChannelId);

        // Rejoindre le vocal (ou s'assurer qu'on y est)
        try {
            await joinVoice(voiceChannel);
        } catch (error) {
            console.error("[Nexa] Impossible de rejoindre le vocal:", error);
            return;
        }

        // Ajouter le track
        const wasEmpty = q.tracks.length === 0;
        enqueue(guildId, track);

        if (wasEmpty) {
            // Lancer la lecture immédiatement
            const played = await playCurrentTrack(guildId);
            if (!played) {
                const channel = this.client.channels.cache.get(textChannelId) as TextChannel;
                await channel?.send({content: "❌ Impossible de lire la musique."}).catch(() => {
                });
            }
        } else {
            // Déjà en cours → juste notifier l'ajout à la file
            const pos = q.tracks.length;
            const channel = this.client.channels.cache.get(textChannelId) as TextChannel;
            const addedMsg = await channel?.send({
                content: `✅ **${track.title}** ajouté en position **#${pos}**`,
            }).catch(() => null);
            if (addedMsg) setTimeout(() => addedMsg.delete().catch(() => {
            }), 5000);
        }

        await this.refreshControlPanel(guildId);
    }

    private async createControlPanel(channel: TextChannel, guildId: string, options: any): Promise<void> {
        try {
            // Nettoyer les anciens messages du bot dans ce salon
            const messages = await channel.messages.fetch({limit: 20}).catch(() => null);
            if (messages) {
                const botMessages = messages.filter(m => m.author.id === this.client.user!.id);
                for (const [, msg] of botMessages) {
                    await msg.delete().catch(() => {
                    });
                }
            }

            const newMsg = await channel.send(options as any);
            const q = getQueue(guildId);
            if (q) q.controlMessageId = newMsg.id;
            else {
                // Stocker l'ID même sans file active (état idle)
                (this.client as any)[`nexa_controlMsg_${guildId}`] = newMsg.id;
            }
        } catch (error) {
            console.error("[Nexa] Erreur lors de la création du panneau:", error);
        }
    }

    /** Restaure les panneaux au redémarrage */
    private async restoreControlPanels(): Promise<void> {
        const musicChannelId = process.env.NEXA_MUSIC_CHANNEL_ID;
        if (!musicChannelId) return;

        const channel = this.client.channels.cache.get(musicChannelId) as TextChannel | undefined;
        if (!channel) {
            // Attendre que le cache du client soit prêt
            setTimeout(() => this.restoreControlPanels(), 3000);
            return;
        }

        // Récupérer l'ID de guilde depuis le channel
        const guildId = channel.guildId;
        await this.refreshControlPanel(guildId);
        console.log(`[Nexa] Panneau de contrôle restauré dans #${channel.name}`);
    }
}

// ─── Singleton
let nexaInstance: NexaBot | null = null;

export function getNexaBot(): NexaBot {
    if (!nexaInstance) {
        nexaInstance = new NexaBot();
    }
    return nexaInstance;
}


