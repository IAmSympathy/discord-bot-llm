/**
 * Nexa - Bot Discord de musique YouTube
 * Utilise Lavalink (via Kazagumo) pour la lecture audio.
 * Aucune commande — tout passe par Components V2 dans le salon dédié.
 */

import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ContainerBuilder, Events, GatewayIntentBits, Message, MessageFlags, SectionBuilder, SeparatorBuilder, TextChannel, TextDisplayBuilder, ThumbnailBuilder,} from "discord.js";
import * as dotenv from "dotenv";
import {getKazagumo, getOrCreatePlayer, initKazagumo, isLavalinkReady, KazagumoPlayer, KazagumoTrack, searchYouTube, skipTrack, stopPlayback, togglePause, waitForLavalink,} from "./musicPlayer";
import {buildNexaMessageOptions} from "./nexaComponents";

dotenv.config();

// ── Adaptateur TrackInfo pour nexaComponents (qui attend l'ancien format)
function trackToInfo(t: KazagumoTrack) {
    const dur = t.length ?? 0;
    const secs = Math.floor(dur / 1000);
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, "0");
    return {
        url: t.uri ?? "",
        title: t.title,
        durationFormatted: t.isStream ? "LIVE" : `${m}:${s}`,
        durationSeconds: secs,
        thumbnail: t.thumbnail ?? "",
        requestedBy: (t as any).requester?.name ?? "",
        requestedById: (t as any).requester?.id ?? "",
        isLive: t.isStream ?? false,
        channelName: t.author ?? "",
    };
}

// ── File GuildQueue simulée depuis le player Kazagumo (pour nexaComponents)
function playerToQueue(player: KazagumoPlayer | undefined, guildId: string, textChannelId: string) {
    if (!player) {
        return {
            guildId, voiceChannelId: "", textChannelId,
            tracks: [], currentIndex: 0,
            loop: "none" as const, isPaused: false,
            controlMessageId: null, volume: 0.8,
        };
    }
    const tracks = player.queue.map(trackToInfo);
    if (player.queue.current) tracks.unshift(trackToInfo(player.queue.current));
    return {
        guildId,
        voiceChannelId: player.voiceId ?? "",
        textChannelId,
        tracks,
        currentIndex: 0,
        loop: player.loop === "track" ? "track" as const
            : player.loop === "queue" ? "queue" as const
                : "none" as const,
        isPaused: player.paused,
        controlMessageId: null,
        volume: (player.volume ?? 80) / 100,
    };
}

export class NexaBot {
    public client: Client;
    private ready = false;
    // controlMessageId par guildId
    private controlMessages = new Map<string, string>();

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
    // PANNEAU DE CONTRÔLE
    // ─────────────────────────────────────────────────────────────────────────

    public async refreshControlPanel(guildId: string): Promise<void> {
        const musicChannelId = process.env.NEXA_MUSIC_CHANNEL_ID;
        if (!musicChannelId) return;

        const channel = this.client.channels.cache.get(musicChannelId) as TextChannel | undefined;
        if (!channel) return;

        const k = getKazagumo();
        const player = k.players.get(guildId);
        const q = playerToQueue(player, guildId, musicChannelId);
        const currentTrack = player?.queue.current ? trackToInfo(player.queue.current) : null;
        const options = buildNexaMessageOptions(q as any, currentTrack);

        const existingId = this.controlMessages.get(guildId);
        if (existingId) {
            const existing = await channel.messages.fetch(existingId).catch(() => null);
            if (existing) {
                await existing.edit(options as any).catch(() => null);
                return;
            }
        }

        await this.createControlPanel(channel, guildId, options);
    }

    private async createControlPanel(channel: TextChannel, guildId: string, options: any): Promise<void> {
        try {
            const messages = await channel.messages.fetch({limit: 20}).catch(() => null);
            if (messages) {
                const botMessages = messages.filter(m => m.author.id === this.client.user!.id);
                for (const [, msg] of botMessages) await msg.delete().catch(() => {
                });
            }
            const newMsg = await channel.send(options as any);
            this.controlMessages.set(guildId, newMsg.id);
        } catch (error) {
            console.error("[Nexa] Erreur panneau:", error);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    private setupEventHandlers(): void {

        this.client.once(Events.ClientReady, async (c) => {
            console.log(`[Nexa] ✓ Bot connecté: ${c.user.tag}`);
            this.ready = true;

            // Initialiser Kazagumo avec ce client
            const k = initKazagumo(this.client);

            // Attendre que Lavalink soit prêt (il démarre ~20s après le bot)
            waitForLavalink(120000).then(ready => {
                if (ready) {
                    console.log("[Nexa] ✅ Lavalink connecté et prêt !");
                } else {
                    console.error("[Nexa] ❌ Lavalink indisponible après 120s");
                }
            });

            // ── Events Kazagumo
            k.on("playerStart", async (player) => {
                console.log(`[Nexa] ▶️ Lecture: ${player.queue.current?.title}`);
                await this.refreshControlPanel(player.guildId);
            });

            k.on("playerEnd", async (player) => {
                await this.refreshControlPanel(player.guildId);
            });

            k.on("playerEmpty", async (player) => {
                console.log(`[Nexa] File vide pour ${player.guildId}`);
                await this.refreshControlPanel(player.guildId);
                // Déconnecter après 5 min d'inactivité
                setTimeout(async () => {
                    const p = k.players.get(player.guildId);
                    if (p && !p.playing && p.queue.size === 0) {
                        await p.destroy();
                        await this.refreshControlPanel(player.guildId);
                    }
                }, 5 * 60 * 1000);
            });

            k.on("playerException", async (player, error) => {
                console.error(`[Nexa] Erreur Lavalink:`, error);
                await this.refreshControlPanel(player.guildId);
            });

            k.shoukaku.on("reconnecting", (name) => {
                console.log(`[Nexa] 🔄 Reconnexion au node "${name}"...`);
            });

            await this.restoreControlPanels();
        });

        // ── Messages dans le salon dédié → recherche
        this.client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot) return;
            const musicChannelId = process.env.NEXA_MUSIC_CHANNEL_ID;
            if (!musicChannelId || message.channelId !== musicChannelId) return;
            await this.handleSearchRequest(message);
        });

        // ── Boutons
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;
            if (!interaction.customId.startsWith("nexa_")) return;
            await interaction.deferUpdate().catch(() => {
            });
            await this.handleButtonInteraction(interaction);
        });

        // ── Salon vide → stop auto
        this.client.on(Events.VoiceStateUpdate, async (oldState) => {
            const guildId = oldState.guild.id;
            const k = getKazagumo();
            const player = k.players.get(guildId);
            if (!player) return;

            const voiceChannel = oldState.guild.channels.cache.get(player.voiceId ?? "");
            if (!voiceChannel?.isVoiceBased()) return;

            const humans = voiceChannel.members.filter(m => !m.user.bot);
            if (humans.size === 0) {
                setTimeout(async () => {
                    const vc = oldState.guild.channels.cache.get(player.voiceId ?? "");
                    if (!vc?.isVoiceBased()) return;
                    if (vc.members.filter(m => !m.user.bot).size === 0) {
                        await player.destroy();
                        await this.refreshControlPanel(guildId);
                    }
                }, 5 * 60 * 1000);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RECHERCHE
    // ─────────────────────────────────────────────────────────────────────────

    private async handleSearchRequest(message: Message): Promise<void> {
        const query = message.content.trim();
        if (!query) return;

        await message.delete().catch(() => {
        });

        // Vérifier que Lavalink est connecté
        if (!isLavalinkReady()) {
            const errMsg = await (message.channel as TextChannel).send({
                content: `⏳ Connexion à Lavalink en cours... réessaie dans quelques secondes.`
            }).catch(() => null);
            if (errMsg) setTimeout(() => errMsg.delete().catch(() => {
            }), 7000);
            return;
        }

        const textChan = message.channel as TextChannel;
        const loadingMsg = await textChan.send({content: `🔍 Recherche de **${query}**...`}).catch(() => null);

        const track = await searchYouTube(query);

        if (loadingMsg) await loadingMsg.delete().catch(() => {
        });

        if (!track) {
            const errMsg = await textChan.send({content: `❌ Aucun résultat pour **${query}**`}).catch(() => null);
            if (errMsg) setTimeout(() => errMsg.delete().catch(() => {
            }), 5000);
            return;
        }

        // Attacher l'auteur au track
        (track as any).requester = {
            name: (await message.guild?.members.fetch(message.author.id).catch(() => null))?.displayName ?? message.author.username,
            id: message.author.id,
        };

        // Message de proposition
        const container = new ContainerBuilder();
        const ti = trackToInfo(track);

        const section = new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🎵 Résultat trouvé\n**[${ti.title}](${ti.url})**\n-# 📺 ${ti.channelName}${ti.isLive ? " · 🔴 LIVE" : ` · ⏱️ ${ti.durationFormatted}`}`
            )
        );
        if (ti.thumbnail) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(ti.thumbnail));

        container.addSectionComponents(section);
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`nexa_confirm_${message.author.id}`).setLabel("▶️ Ajouter à la file").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`nexa_cancel_${message.author.id}`).setLabel("✖ Annuler").setStyle(ButtonStyle.Secondary)
            )
        );

        const pendingKey = `nexa_pending_${message.author.id}`;
        (this.client as any)[pendingKey] = {track, guildId: message.guild!.id, textChannelId: message.channelId};
        setTimeout(() => delete (this.client as any)[pendingKey], 5 * 60 * 1000);

        const proposalMsg = await textChan.send({components: [container], flags: MessageFlags.IsComponentsV2}).catch(() => null);
        if (proposalMsg) setTimeout(() => proposalMsg.delete().catch(() => {
        }), 5 * 60 * 1000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BOUTONS
    // ─────────────────────────────────────────────────────────────────────────

    private async handleButtonInteraction(interaction: any): Promise<void> {
        const customId: string = interaction.customId;
        const guildId: string = interaction.guildId;
        const k = getKazagumo();

        if (customId.startsWith("nexa_confirm_")) {
            const userId = customId.replace("nexa_confirm_", "");
            if (interaction.user.id !== userId) return;
            const pending = (this.client as any)[`nexa_pending_${userId}`];
            if (!pending) return;
            delete (this.client as any)[`nexa_pending_${userId}`];
            await interaction.message.delete().catch(() => {
            });
            await this.addTrackAndPlay(guildId, pending.track, pending.textChannelId, interaction);
            return;
        }

        if (customId.startsWith("nexa_cancel_")) {
            const userId = customId.replace("nexa_cancel_", "");
            if (interaction.user.id !== userId) return;
            delete (this.client as any)[`nexa_pending_${userId}`];
            await interaction.message.delete().catch(() => {
            });
            return;
        }

        const player = k.players.get(guildId);
        if (!player) return;

        switch (customId) {
            case "nexa_playpause":
                await togglePause(guildId);
                await this.refreshControlPanel(guildId);
                break;
            case "nexa_skip":
                await skipTrack(guildId);
                break;
            case "nexa_prev":
                // Lavalink ne supporte pas le retour arrière nativement — on remet le même
                if (player.queue.current) {
                    const prev = player.queue.current;
                    await player.skip();
                    player.queue.unshift(prev);
                }
                break;
            case "nexa_stop":
                await stopPlayback(guildId);
                await this.refreshControlPanel(guildId);
                break;
            case "nexa_loop": {
                const cycle: Array<"none" | "track" | "queue"> = ["none", "track", "queue"];
                const cur = player.loop === "track" ? "track" : player.loop === "queue" ? "queue" : "none";
                const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
                player.setLoop(next === "none" ? undefined : next);
                await this.refreshControlPanel(guildId);
                break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AJOUT + LECTURE
    // ─────────────────────────────────────────────────────────────────────────

    private async addTrackAndPlay(guildId: string, track: KazagumoTrack, textChannelId: string, interaction: any): Promise<void> {
        const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            const channel = this.client.channels.cache.get(textChannelId) as TextChannel;
            const msg = await channel?.send({content: `❌ <@${interaction.user.id}> Tu dois être dans un salon vocal !`}).catch(() => null);
            if (msg) setTimeout(() => msg.delete().catch(() => {
            }), 5000);
            return;
        }

        try {
            const player = await getOrCreatePlayer(guildId, voiceChannel.id, textChannelId);
            player.queue.add(track);

            if (!player.playing && !player.paused) {
                await player.play();
            } else {
                const pos = player.queue.size;
                const channel = this.client.channels.cache.get(textChannelId) as TextChannel;
                const addedMsg = await channel?.send({content: `✅ **${track.title}** ajouté en position **#${pos}**`}).catch(() => null);
                if (addedMsg) setTimeout(() => addedMsg.delete().catch(() => {
                }), 5000);
                await this.refreshControlPanel(guildId);
            }
        } catch (error) {
            console.error("[Nexa] Erreur addTrackAndPlay:", error);
        }
    }

    private async restoreControlPanels(): Promise<void> {
        const musicChannelId = process.env.NEXA_MUSIC_CHANNEL_ID;
        if (!musicChannelId) return;
        const channel = this.client.channels.cache.get(musicChannelId) as TextChannel | undefined;
        if (!channel) {
            setTimeout(() => this.restoreControlPanels(), 3000);
            return;
        }
        await this.refreshControlPanel(channel.guildId);
        console.log(`[Nexa] Panneau restauré dans #${channel.name}`);
    }
}

let nexaInstance: NexaBot | null = null;

export function getNexaBot(): NexaBot {
    if (!nexaInstance) nexaInstance = new NexaBot();
    return nexaInstance;
}
