import {AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, joinVoiceChannel} from "@discordjs/voice";
import {VoiceBasedChannel} from "discord.js";
import * as path from "path";
import * as fs from "fs";
import {logKlodovikVoice} from "../../utils/discordLogger";

/**
 * Service pour gérer les sons vocaux aléatoires de Klodovik
 */
export class KlodovikVoiceService {
    private static instance: KlodovikVoiceService;
    private readonly soundsPath: string;
    private isPlaying: boolean = false;

    private constructor() {
        this.soundsPath = path.join(process.cwd(), "assets", "klodovik_sounds");
        this.ensureSoundsDirectory();
    }

    public static getInstance(): KlodovikVoiceService {
        if (!KlodovikVoiceService.instance) {
            KlodovikVoiceService.instance = new KlodovikVoiceService();
        }
        return KlodovikVoiceService.instance;
    }

    /**
     * Rejoindre un salon vocal et jouer un son aléatoire avec effets
     */
    public async playRandomSound(channel: VoiceBasedChannel): Promise<boolean> {
        if (!this.canJoinChannel(channel)) {
            return false;
        }

        const soundFile = this.getRandomSound();
        if (!soundFile) {
            return false;
        }

        this.isPlaying = true;
        console.log(`[Klodovik Voice] 🎵 Rejoint ${channel.name} pour jouer: ${soundFile}`);

        try {
            // Rejoindre le salon vocal
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator as any,
            });

            // Créer le lecteur audio
            const player = createAudioPlayer();

            // Créer la ressource audio
            const audioPath = path.join(this.soundsPath, soundFile);
            const volume = this.getRandomVolume();

            const resource = createAudioResource(audioPath, {
                inlineVolume: true,
            });

            // Définir le volume aléatoire (entre 50% et 100%)
            resource.volume?.setVolume(volume);

            console.log(`[Klodovik Voice] Son: ${soundFile} | Volume: ${Math.round(volume * 100)}%`);

            // Log Discord
            await logKlodovikVoice(channel.name, soundFile, volume);

            // Jouer le son
            player.play(resource);
            connection.subscribe(player);

            // Quitter automatiquement après la fin du son
            player.on(AudioPlayerStatus.Idle, () => {
                console.log("[Klodovik Voice] Son terminé, déconnexion...");
                connection.destroy();
                this.isPlaying = false;
            });

            // Timeout de sécurité (30 secondes max)
            setTimeout(() => {
                if (connection.state.status !== "destroyed") {
                    console.log("[Klodovik Voice] Timeout, déconnexion forcée");
                    connection.destroy();
                    this.isPlaying = false;
                }
            }, 30000);

            return true;
        } catch (error) {
            console.error("[Klodovik Voice] Erreur lors de la lecture du son:", error);
            this.isPlaying = false;
            return false;
        }
    }

    /**
     * Vérifie si le service est prêt (au moins 1 son disponible)
     */
    public isReady(): boolean {
        return this.getAvailableSounds().length > 0;
    }

    /**
     * Obtient le nombre de sons disponibles
     */
    public getSoundsCount(): number {
        return this.getAvailableSounds().length;
    }

    /**
     * Crée le dossier des sons s'il n'existe pas
     */
    private ensureSoundsDirectory(): void {
        if (!fs.existsSync(this.soundsPath)) {
            fs.mkdirSync(this.soundsPath, {recursive: true});
            console.log(`[Klodovik Voice] Dossier créé: ${this.soundsPath}`);
            console.log("[Klodovik Voice] ⚠️ Ajoutez des fichiers audio (.mp3, .wav, .ogg) dans assets/klodovik_sounds/");
        }
    }

    /**
     * Récupère tous les fichiers audio disponibles
     */
    private getAvailableSounds(): string[] {
        try {
            const files = fs.readdirSync(this.soundsPath);
            return files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return [".mp3", ".wav", ".ogg", ".webm"].includes(ext);
            });
        } catch (error) {
            console.error("[Klodovik Voice] Erreur lors de la lecture des sons:", error);
            return [];
        }
    }

    /**
     * Sélectionne un son aléatoire
     */
    private getRandomSound(): string | null {
        const sounds = this.getAvailableSounds();
        if (sounds.length === 0) {
            console.warn("[Klodovik Voice] Aucun fichier audio trouvé dans assets/klodovik_sounds/");
            return null;
        }
        return sounds[Math.floor(Math.random() * sounds.length)];
    }

    /**
     * Génère un volume aléatoire
     * Volume entre 50% et 100% pour que ce soit toujours audible mais varié
     */
    private getRandomVolume(): number {
        return 0.5 + Math.random() * 0.7;
    }


    /**
     * Vérifie si Klodovik peut rejoindre ce salon
     */
    private canJoinChannel(channel: VoiceBasedChannel): boolean {
        // Vérifier qu'il y a au moins 1 personne (autre que des bots)
        const members = channel.members.filter(m => !m.user.bot);
        if (members.size === 0) return false;

        // Vérifier qu'on n'est pas déjà en train de jouer
        if (this.isPlaying) return false;

        // Vérifier qu'il n'y a pas déjà une connexion vocale
        const existingConnection = getVoiceConnection(channel.guild.id);
        if (existingConnection) return false;

        return true;
    }
}






