import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel, User, VoiceChannel} from "discord.js";
import {logCommand} from "../../utils/discordLogger";
import {addXP, XP_REWARDS} from "../../services/xpSystem";
import * as fs from "fs";
import * as path from "path";
import {DATA_DIR} from "../../utils/constants";

const SHIP_RIGGED_FILE = path.join(DATA_DIR, "ship_rigged_data.json");

// IDs spéciaux pour le ship rigged
const RIGGED_USER_1 = "288799652902469633";
const RIGGED_USER_2 = "746147605595160697";

// Noms spéciaux pour le ship rigged (normalisés en minuscules)
const RIGGED_NAMES = [
    ["Samy", "Laéticia"],
    ["IAmSympathy", "Mercure"]
];

interface RiggedData {
    lastDate: string; // Format: YYYY-MM-DD
    count: number;
}

function loadRiggedData(): Record<string, RiggedData> {
    try {
        if (fs.existsSync(SHIP_RIGGED_FILE)) {
            const data = fs.readFileSync(SHIP_RIGGED_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error loading rigged ship data:", error);
    }
    return {};
}

function saveRiggedData(data: Record<string, RiggedData>): void {
    try {
        fs.writeFileSync(SHIP_RIGGED_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
        console.error("Error saving rigged ship data:", error);
    }
}

function shouldRig(userId1: string, userId2: string, name1: string, name2: string): boolean {
    // Vérifier si c'est le couple spécial par IDs Discord
    const isSpecialCoupleById =
        (userId1 === RIGGED_USER_1 && userId2 === RIGGED_USER_2) ||
        (userId1 === RIGGED_USER_2 && userId2 === RIGGED_USER_1);

    // Vérifier si c'est le couple spécial par noms
    const normalizedName1 = name1.toLowerCase().trim();
    const normalizedName2 = name2.toLowerCase().trim();

    const isSpecialCoupleByName = RIGGED_NAMES.some(pair =>
        (normalizedName1 === pair[0] && normalizedName2 === pair[1]) ||
        (normalizedName1 === pair[1] && normalizedName2 === pair[0])
    );

    if (!isSpecialCoupleById && !isSpecialCoupleByName) {
        return false;
    }

    // Charger les données
    const riggedData = loadRiggedData();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = "special_couple";

    // Vérifier si on a déjà des données pour aujourd'hui
    if (riggedData[key] && riggedData[key].lastDate === today) {
        // Si on a déjà fait 3 ships aujourd'hui, ne pas rigger
        if (riggedData[key].count >= 3) {
            return false;
        }
        // Incrémenter le compteur
        riggedData[key].count++;
    } else {
        // Nouveau jour, réinitialiser
        riggedData[key] = {
            lastDate: today,
            count: 1
        };
    }

    // Sauvegarder les données mises à jour
    saveRiggedData(riggedData);

    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ship")
        .setDescription("Calcule la compatibilité entre deux personnes ❤️")
        .addStringOption((option) =>
            option
                .setName("person1")
                .setDescription("Première personne (mention ou nom)")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("person2")
                .setDescription("Deuxième personne (mention ou nom)")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const person1Input = interaction.options.getString("person1", true);
            const person2Input = interaction.options.getString("person2", true);

            // Essayer d'extraire les utilisateurs mentionnés
            let person1Name: string;
            let person1User: User | null = null;

            let person2Name: string;
            let person2User: User | null = null;

            // Extraire la première personne
            const user1Match = person1Input.match(/<@!?(\d+)>/);
            if (user1Match) {
                try {
                    person1User = await interaction.client.users.fetch(user1Match[1]);
                    person1Name = person1User.displayName;
                } catch {
                    person1Name = person1Input;
                }
            } else {
                person1Name = person1Input;
            }

            // Extraire la deuxième personne
            const user2Match = person2Input.match(/<@!?(\d+)>/);
            if (user2Match) {
                try {
                    person2User = await interaction.client.users.fetch(user2Match[1]);
                    person2Name = person2User.displayName;
                } catch {
                    person2Name = person2Input;
                }
            } else {
                person2Name = person2Input;
            }

            // Vérifier si on doit rigger le résultat (couple spécial, max 3 fois par jour)
            let compatibility: number;
            const userId1 = person1User?.id || "";
            const userId2 = person2User?.id || "";

            if (shouldRig(userId1, userId2, person1Name, person2Name)) {
                // Résultat rigged : toujours entre 95 et 100%
                compatibility = Math.floor(Math.random() * (100 - 95 + 1)) + 95;
            } else {
                // ...existing code...
                // Calculer un pourcentage de compatibilité déterministe basé sur les noms
                // Utiliser une fonction de hachage simple pour que le même couple donne toujours le même résultat
                const hash = (str: string) => {
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) {
                        const char = str.charCodeAt(i);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash; // Convertir en entier 32 bits
                    }
                    return Math.abs(hash);
                };

                // Normaliser les noms (minuscules et triés pour que A+B = B+A)
                const names = [person1Name.toLowerCase(), person2Name.toLowerCase()].sort();
                const combinedHash = hash(names.join(''));
                compatibility = (combinedHash % 101); // 0-100%
            }

            // Déterminer le message et l'emoji selon le pourcentage
            let message: string;
            let emoji: string;
            let color: number;
            let heart: string;

            if (compatibility >= 90) {
                message = "Match parfait ! 💕 Vous êtes faits l'un pour l'autre !";
                emoji = "💖";
                color = 0xFF1493; // Rose vif
                heart = "💕💕💕";
            } else if (compatibility >= 75) {
                message = "Excellente compatibilité ! 💗 Ça pourrait vraiment marcher !";
                emoji = "💗";
                color = 0xFF69B4; // Rose
                heart = "💕💕";
            } else if (compatibility >= 60) {
                message = "Bonne compatibilité ! 💓 Il y a du potentiel !";
                emoji = "💓";
                color = 0xFFC0CB; // Rose clair
                heart = "💕";
            } else if (compatibility >= 40) {
                message = "Compatibilité moyenne 💛 Ça dépendra de vos efforts !";
                emoji = "💛";
                color = 0xFFD700; // Or
                heart = "💛";
            } else if (compatibility >= 25) {
                message = "Compatibilité faible 💔 Ce sera difficile...";
                emoji = "💔";
                color = 0xFFA500; // Orange
                heart = "💔";
            } else {
                message = "Aucune compatibilité 💀 Peut-être dans une autre vie...";
                emoji = "💀";
                color = 0x808080; // Gris
                heart = "💀";
            }

            // Créer le nom de ship (fusionner les deux noms)
            const shipName = person1Name.substring(0, Math.ceil(person1Name.length / 2)) +
                person2Name.substring(Math.floor(person2Name.length / 2));

            // Créer l'embed
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`${emoji} Résultat du Ship`)
                .addFields(
                    {
                        name: "💑 Couple",
                        value: `${person1Name} 💕 ${person2Name}`,
                        inline: false
                    },
                    {
                        name: "💕 Ship Name",
                        value: `${shipName}`,
                        inline: false
                    },
                    {
                        name: "💯 Compatibilité",
                        value: `${compatibility}%`,
                        inline: false
                    },
                    {
                        name: "📝 Verdict",
                        value: message,
                        inline: false
                    }
                )
                .setFooter({text: `Demandé par ${interaction.user.displayName}`})
                .setTimestamp();

            await interaction.reply({embeds: [embed]});

            // Logger la commande
            await logCommand(
                `${emoji} Ship`,
                undefined,
                [
                    {name: "👤 Utilisateur", value: interaction.user.username, inline: true},
                    {name: "💑 Couple", value: `${person1Name} + ${person2Name}`, inline: true},
                    {name: "💯 Résultat", value: `${compatibility}%`, inline: true}
                ]
            );

            // Donner de l'XP
            const channel = interaction.channel;
            if (channel && (channel instanceof TextChannel || channel instanceof VoiceChannel)) {
                await addXP(
                    interaction.user.id,
                    interaction.user.username,
                    XP_REWARDS.commandeUtilisee,
                    channel,
                    false
                );
            }

        } catch (error) {
            console.error("Error executing ship command:", error);
            await interaction.reply({
                content: "❌ Une erreur s'est produite lors du calcul de la compatibilité.",
                ephemeral: true
            });
        }
    },
};
