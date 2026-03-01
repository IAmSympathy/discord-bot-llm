/**
 * Nexa - Composant V2 (Discord Components v2)
 * Construit le message persistant de contrôle musical avec boutons et embed
 */

import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, TextDisplayBuilder, ThumbnailBuilder,} from "discord.js";
import {GuildQueue, TrackInfo} from "./musicQueue";

/** Construit l'objet components[] pour le message de contrôle Nexa */
export function buildNexaControlComponents(
    queue: GuildQueue,
    currentTrack: TrackInfo | null
): any[] {
    const isPaused = queue.isPaused;
    const isPlaying = !!currentTrack;
    const loop = queue.loop;

    const container = new ContainerBuilder();

    if (currentTrack) {
        // Section titre + thumbnail via SectionBuilder
        const section = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## 🎵 Nexa - Maintenant en écoute\n**[${currentTrack.title}](${currentTrack.url})**\n-# 📺 ${currentTrack.channelName}${currentTrack.isLive ? " · 🔴 LIVE" : ` · ⏱️ ${currentTrack.durationFormatted}`} · Demandé par **${currentTrack.requestedBy}**`
                )
            );

        if (currentTrack.thumbnail) {
            section.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(currentTrack.thumbnail)
            );
        }

        container.addSectionComponents(section);
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                "## 🎵 Nexa - Bot Musical\n*Aucune musique en cours.*\n-# Envoie le titre d'une chanson dans ce salon pour lancer la musique !"
            )
        );
    }

    // ─── Séparateur
    container.addSeparatorComponents(new SeparatorBuilder());

    // ─── Boutons de contrôle
    const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("nexa_prev")
            .setLabel("⏮")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!isPlaying),

        new ButtonBuilder()
            .setCustomId("nexa_playpause")
            .setLabel(isPaused ? "▶️ Reprendre" : "⏸ Pause")
            .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(!isPlaying),

        new ButtonBuilder()
            .setCustomId("nexa_skip")
            .setLabel("⏭ Skip")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!isPlaying),

        new ButtonBuilder()
            .setCustomId("nexa_stop")
            .setLabel("⏹ Stop")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!isPlaying),

        new ButtonBuilder()
            .setCustomId("nexa_loop")
            .setLabel(
                loop === "none" ? "🔁 Loop : Off" :
                    loop === "track" ? "🔂 Loop : Titre" : "🔁 Loop : File"
            )
            .setStyle(loop === "none" ? ButtonStyle.Secondary : ButtonStyle.Success)
    );

    container.addActionRowComponents(controlRow);

    // ─── File d'attente (5 prochains)
    container.addSeparatorComponents(new SeparatorBuilder());

    const upcomingTracks = queue.tracks.slice(queue.currentIndex + 1, queue.currentIndex + 6);

    if (upcomingTracks.length > 0) {
        const queueLines = upcomingTracks
            .map((t, i) => `**${queue.currentIndex + i + 2}.** ${t.title} · *${t.durationFormatted}*`)
            .join("\n");
        const remaining = queue.tracks.length - queue.currentIndex - 1;
        const suffix = remaining > 5 ? `\n-# *… et ${remaining - 5} autre(s)*` : "";
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**📋 File d'attente :**\n${queueLines}${suffix}`)
        );
    } else if (isPlaying) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("-# *File vide après ce titre.*")
        );
    }

    return [container];
}

/** Options pour envoyer le message de contrôle */
export function buildNexaMessageOptions(
    queue: GuildQueue,
    currentTrack: TrackInfo | null
) {
    return {
        components: buildNexaControlComponents(queue, currentTrack),
        flags: MessageFlags.IsComponentsV2,
    };
}
