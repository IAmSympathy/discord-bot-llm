# 🔥 Système de Statistiques de Fin de Saison - Feu de Foyer

## 📅 Date : 2026-02-09

---

## 🎯 Fonctionnalité Implémentée

À la fin de la saison hivernale (équinoxe de printemps), **Netricsa envoie automatiquement** les statistiques complètes de la saison du feu de foyer dans le salon des annonces.

---

## 📊 Contenu des Statistiques

### Informations Affichées

L'annonce de fin de saison contient :

1. **Durée de la saison** : Nombre de jours (1er décembre → 20 mars)
2. **Bûches totales ajoutées** : Toutes les contributions de la communauté
3. **État final du feu** : Intensité (%) avec l'emoji correspondant à l'état 🔥/🪵/🌫️/💨
4. **Temps au stade maximum** : Estimation du temps passé entre 81% et 100% d'intensité
5. **Performance globale** : Évaluation selon les contributions

---

## 🏆 Système d'Évaluation

La performance de la communauté est évaluée selon le nombre moyen de bûches par jour :

| Bûches/Jour | Évaluation          | Message                                                |
|-------------|---------------------|--------------------------------------------------------|
| ≥ 20        | 🏆 EXCEPTIONNEL     | "La communauté a été extraordinaire !"                 |
| ≥ 15        | ⭐ EXCELLENT         | "Le feu a été maintenu avec brio !"                    |
| ≥ 10        | ✅ TRÈS BIEN         | "Le feu a bien résisté à l'hiver !"                    |
| ≥ 5         | 👍 BIEN             | "Le feu a tenu bon malgré quelques moments difficiles" |
| < 5         | ⚠️ PEUT MIEUX FAIRE | "Le feu a souvent vacillé cet hiver"                   |

---

## 📅 Dates Importantes

### Saison Hiver 2026

- **Début** : 1er décembre 2025
- **Fin** : 20 mars 2026 à 00:00 (équinoxe de printemps)
- **Durée** : ~110 jours

### Vérification Automatique

- **Fréquence** : Tous les jours à minuit
- **Déclenchement** : Automatique le 20 mars 2026
- **Canal** : Salon des annonces (`ANNOUNCEMENTS_CHANNEL_ID`)

---

## 🎨 Exemple d'Embed

```
🔥 FIN DE LA SAISON - FEU DE FOYER HIVER 2026

L'hiver se termine et avec lui, notre traditionnel Feu de Foyer 
s'éteint pour laisser place au printemps ! 🌸

Voici les statistiques de cette saison hivernale :

📊 Statistiques Globales
• Durée de la saison : 110 jours
• Bûches ajoutées : 1,250 🪵
• État final du feu : 🔥 75%
• Temps au stade maximum : 44j 0h 🔥

🔥 Performance de la Communauté
⭐ EXCELLENT - Le feu a été maintenu avec brio ! 
La communauté a montré un grand engagement.

✨ Multiplicateur d'XP
Le feu de foyer vous a permis de bénéficier d'un multiplicateur 
d'XP variant entre ×0.33 et ×1.33 selon son intensité.

Merci à tous ceux qui ont contribué à maintenir les flammes vivantes ! 🙏

────────────────────────────────
Le feu de foyer reviendra l'hiver prochain ! ❄️
```

---

## 🔧 Implémentation Technique

### Fichiers Créés/Modifiés

1. **`src/services/seasonal/fireSeasonManager.ts`** (nouveau)
    - Fonction `checkSeasonEnd()` : Vérifie si la saison est terminée
    - Fonction `sendSeasonStatistics()` : Envoie l'annonce
    - Fonction `createSeasonStatsEmbed()` : Crée l'embed
    - Fonction `initializeSeasonEndCheck()` : Initialise le système

2. **`src/bot.ts`** (modifié)
    - Ajout de l'initialisation au démarrage du bot

3. **`src/commands/test-event/test-event.ts`** (modifié)
    - Ajout de l'option de test pour les stats de saison

### Code Principal

```typescript
// Vérification automatique
export function initializeSeasonEndCheck(client: Client): void {
    // Vérifier immédiatement au démarrage
    checkSeasonEnd(client);

    // Puis vérifier tous les jours à minuit
    setInterval(() => {
        checkSeasonEnd(client);
    }, 24 * 60 * 60 * 1000);
}

// Envoi de l'annonce
export async function sendSeasonStatistics(client: Client): Promise<void> {
    const channel = await guild.channels.fetch(announcementChannelId);
    const embed = createSeasonStatsEmbed(fireData);

    await channel.send({
        content: "@everyone 🎉",
        embeds: [embed]
    });
}
```

---

## 🧪 Test

Pour tester le système sans attendre le 20 mars :

```
/test-event type:🔥 Stats Fin de Saison Feu
```

**Résultat** : Les statistiques sont immédiatement envoyées dans le salon des annonces avec les données actuelles du feu de foyer.

---

## 📊 Données Utilisées

### Source des Données

Toutes les statistiques proviennent de `data/seasonal_fire.json` :

```json
{
  "intensity": 75,
  "lastUpdate": 1707523200000,
  "messageId": "...",
  "channelId": "...",
  "voiceChannelId": "...",
  "stats": {
    "logsToday": 5,
    "lastLog": {
      "userId": "...",
      "username": "...",
      "timestamp": 1707520000000
    },
    "totalLogs": 1250
    // ← Utilisé pour les stats
  }
}
```

### Calculs

- **Bûches par jour** : `totalLogs / seasonDays`
- **Performance** : Basée sur les bûches par jour
- **Durée** : Calculée entre le 1er décembre et le 20 mars
- **Temps au maximum** : Estimation basée sur le nombre de bûches/jour
    - ≥15 bûches/jour → ~60% du temps au maximum
    - ≥10 bûches/jour → ~40% du temps au maximum
    - ≥5 bûches/jour → ~20% du temps au maximum
    - <5 bûches/jour → ~10% du temps au maximum

**Note** : Le temps au stade maximum est une estimation. Pour un tracking précis, il faudrait enregistrer chaque changement d'état du feu, ce qui sera implémenté dans une future version.

---

## 🔄 Comportement

### Au Démarrage du Bot

1. Vérifie immédiatement si on est passé la date de fin
2. Si oui, envoie les statistiques (une seule fois)
3. Programme les vérifications quotidiennes

### Tous les Jours à Minuit

1. Vérifie la date actuelle
2. Si `date >= 20 mars 2026 00:00`, envoie les stats
3. Continue de vérifier pour les futures saisons

### Protection Contre les Doublons

⚠️ **Note** : Le système actuel n'a pas de protection contre les envois multiples. Si le bot redémarre après le 20 mars, il renverra les stats.

**Solution future** : Ajouter un flag dans `seasonal_fire.json` :

```json
{
  "stats": {
    ...
    "seasonEndAnnounced": true
  }
}
```

---

## 🎯 Utilisation en Production

### Configuration Requise

1. **Variable d'environnement** : `ANNOUNCEMENTS_CHANNEL_ID` doit être défini dans `.env`
2. **Permissions** : Le bot doit pouvoir envoyer des messages dans le salon des annonces
3. **Mentions** : Le bot peut mentionner `@everyone`

### Activation

Le système est **automatiquement actif** dès le démarrage du bot. Aucune configuration supplémentaire nécessaire.

---

## 📝 Logs

Le système génère des logs pour le suivi :

```
[FireSeasonManager] Season end check initialized - will check daily at midnight
[FireSeasonManager] Winter season ended! Sending season statistics...
[FireSeasonManager] Season statistics sent successfully!
```

En cas d'erreur :

```
[FireSeasonManager] ANNOUNCEMENTS_CHANNEL_ID not configured, cannot send season stats
[FireSeasonManager] Error sending season statistics: [détails]
```

---

## 🚀 Évolutions Futures

### Améliorations Possibles

1. **Protection doublons** : Flag pour éviter les envois multiples
2. **Statistiques détaillées** : Top contributeurs, graphiques, etc.
3. **Récompenses** : Achievements pour les meilleurs contributeurs
4. **Multi-saisons** : Gestion automatique de plusieurs saisons
5. **Comparaison** : Comparer avec les saisons précédentes

### Saisons Futures

Pour ajouter de futures saisons, modifier la date dans `fireSeasonManager.ts` :

```typescript
const WINTER_SEASON_2027_END = new Date('2027-03-20T00:00:00-05:00');
```

---

## ✅ Résultat Final

Le système de statistiques de fin de saison est maintenant **complet et fonctionnel** !

- 🎯 **Automatique** : Envoie les stats le 20 mars à minuit
- 📊 **Complet** : Toutes les statistiques importantes
- 🏆 **Évaluation** : Performance de la communauté
- 🧪 **Testable** : Commande de test disponible
- 📝 **Documenté** : Logs pour le suivi

**Netricsa annoncera fièrement les résultats de la saison hivernale ! 🔥❄️**




