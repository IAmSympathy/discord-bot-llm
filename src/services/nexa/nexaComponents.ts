/**
 * Nexa - Components V2 du panneau jukebox
 */

import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, TextDisplayBuilder, ThumbnailBuilder,} from "discord.js";
import type {Player, Track} from "lavalink-client";

function fmt(ms: number): string {
    if (!ms) return "0:00";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function trackToDisplay(t: Track) {
    return {
        title: t.info.title,
        url: t.info.uri ?? "",
        duration: t.info.isStream ? "LIVE" : fmt(t.info.duration ?? 0),
        thumbnail: t.info.artworkUrl ?? "",
        channel: t.info.author ?? "",
        isLive: t.info.isStream ?? false,
        requestedBy: (t as any).requester?.username ?? (t as any).requester?.name ?? "",
        requestedById: (t as any).requester?.id ?? "",
    };
}

/** Construit le message Components V2 du panneau jukebox */
export function buildJukeboxPanel(player: Player | null): { components: any[]; flags: number } {
    const container = new ContainerBuilder();

    const current = player?.queue?.current as Track | null | undefined;
    const isPaused = player?.paused ?? false;
    const isPlaying = !!current;
    const repeatMode = player?.repeatMode ?? "off";
    const volume = player?.volume ?? 80;
    const queue = (player?.queue?.tracks ?? []) as Track[];

    // ── Section titre + thumbnail
    if (current) {
        const info = trackToDisplay(current);
        const section = new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🎵 Nexa — En écoute\n**[${info.title}](${info.url})**\n-# 📺 ${info.channel}${info.isLive ? " · 🔴 LIVE" : ` · ⏱️ ${info.duration}`}${info.requestedBy ? ` · demandé par **${info.requestedBy}**` : ""}`
            )
        );
        if (info.thumbnail) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(info.thumbnail));
        container.addSectionComponents(section);
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                "## 🎵 Nexa — Jukebox\n*Aucune musique en cours.*\n-# Envoie le titre d'une chanson dans ce salon pour lancer la lecture !"
            )
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    // ── Boutons ligne 1 : contrôles lecture
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
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
                .setLabel(repeatMode === "off" ? "🔁 Loop : Off" : repeatMode === "track" ? "🔂 Loop : Titre" : "🔁 Loop : File")
                .setStyle(repeatMode === "off" ? ButtonStyle.Secondary : ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("nexa_shuffle")
                .setLabel("🔀 Shuffle")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(queue.length < 2),
        )
    );

    // ── Boutons ligne 2 : volume
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("nexa_vol_down")
                .setLabel("🔉 -10%")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!isPlaying),
            new ButtonBuilder()
                .setCustomId("nexa_vol_up")
                .setLabel("🔊 +10%")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!isPlaying),
            new ButtonBuilder()
                .setCustomId("nexa_vol_info")
                .setLabel(`Volume : ${volume}%`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    // ── File d'attente (5 prochains)
    if (queue.length > 0) {
        const lines = queue.slice(0, 5).map((t, i) => {
            const info = trackToDisplay(t);
            return `**${i + 1}.** ${info.title} · *${info.duration}*`;
        });
        const extra = queue.length > 5 ? `\n-# *… et ${queue.length - 5} autre(s)*` : "";
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**📋 File d'attente :**\n${lines.join("\n")}${extra}`)
        );
    } else if (isPlaying) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("-# *File vide après ce titre.*")
        );
    }

    return {components: [container], flags: MessageFlags.IsComponentsV2};
}

/** Message de confirmation d'ajout de track */
export function buildTrackProposal(track: Track, userId: string): { components: any[]; flags: number } {
    const info = trackToDisplay(track);
    const container = new ContainerBuilder();

    const section = new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### 🎵 Résultat trouvé\n**[${info.title}](${info.url})**\n-# 📺 ${info.channel}${info.isLive ? " · 🔴 LIVE" : ` · ⏱️ ${info.duration}`}`
        )
    );
    if (info.thumbnail) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(info.thumbnail));
    container.addSectionComponents(section);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`nexa_confirm_${userId}`).setLabel("▶️ Ajouter à la file").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`nexa_cancel_${userId}`).setLabel("✖ Annuler").setStyle(ButtonStyle.Secondary),
        )
    );

    return {components: [container], flags: MessageFlags.IsComponentsV2};
}

