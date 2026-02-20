# Changelog - Fonctionnalité "Déplacer un message"

## [Ajout] 2026-02-20

### Nouvelle fonctionnalité : Menu contextuel "Déplacer"

#### 🎯 Description

Ajout d'une commande de menu contextuel permettant de déplacer des messages d'un salon à un autre tout en conservant l'identité de l'auteur original (similaire à Pippin The Mover).

#### 📁 Fichiers ajoutés

- `src/commands/context/moveMessage.ts` - Implémentation de la commande
- `src/commands/context/README_MOVE_MESSAGE.md` - Documentation utilisateur
- `verify-move-command.js` - Script de vérification

#### 📝 Fichiers modifiés

- `src/bot.ts` - Ajout du gestionnaire pour les commandes de menu contextuel de message

#### ✨ Fonctionnalités

- **Menu contextuel** : Accessible via clic droit → Applications → Déplacer
- **Sélecteur de salon** : Interface éphémère pour choisir la destination
- **Conservation de l'identité** : Le message est envoyé avec le nom et la photo de l'auteur original
- **Support multi-canaux** : Salons textuels, annonces, threads publics/privés
- **Message de référence** : Trace du déplacement dans le salon source
- **Webhooks intelligents** : Réutilisation des webhooks existants

#### 🔒 Sécurité

- Vérification de la permission "Gérer les messages" pour l'utilisateur
- Vérification des permissions du bot dans le salon de destination
- Messages d'erreur clairs et en français

#### 🎨 Types de canaux supportés

- ✅ Salons textuels (GuildText)
- ✅ Salons d'annonces (GuildNews)
- ✅ Threads publics (PublicThread)
- ✅ Threads privés (PrivateThread)
- ❌ Salons Stage (GuildStageVoice) - Non supportés

#### 🔧 Détails techniques

- **Type de commande** : MESSAGE context menu
- **Réponse** : Éphémère (visible uniquement par l'utilisateur)
- **Timeout** : 60 secondes pour sélectionner un salon
- **Méthode** : Webhooks Discord pour préserver l'identité
- **Gestion des threads** : Webhook créé dans le canal parent

#### 📊 Intégrations

- Enregistrement dans les statistiques de commandes
- Attribution de XP pour l'utilisation
- Vérification des achievements Discord

#### 🐛 Gestion des erreurs

- Timeout du sélecteur de salon
- Permissions insuffisantes (utilisateur ou bot)
- Messages système (non déplaçables)
- Canaux non supportés
- Erreurs réseau

#### 📚 Documentation

Un guide complet est disponible dans `src/commands/context/README_MOVE_MESSAGE.md` comprenant :

- Instructions d'utilisation
- Permissions requises
- Fonctionnement technique
- Exemples d'utilisation
- Limitations

#### 🚀 Déploiement

La commande sera automatiquement enregistrée au prochain démarrage du bot. Aucune configuration supplémentaire n'est nécessaire.

#### ✅ Tests

Script de vérification fourni : `verify-move-command.js`

```bash
node verify-move-command.js
```

#### 🎯 Utilisation

1. Clic droit sur un message
2. Sélectionner "Applications" → "Déplacer"
3. Choisir le salon de destination
4. Le message est déplacé avec l'identité de l'auteur original

#### 🔄 Compatibilité

- ✅ Discord.js v14
- ✅ TypeScript 5.7+
- ✅ Node.js (version du projet)
- ✅ Déploiement local et Oracle Cloud

---

## Notes de version

Cette fonctionnalité reproduit le comportement de "Pippin The Mover" et est immédiatement utilisable après le redémarrage du bot.

