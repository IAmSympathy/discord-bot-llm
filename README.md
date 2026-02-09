Follow along: https://youtu.be/aNzc8BsPIkQ

1. Check what models are running on Ollama: ```ollama ps```
2. Npm install: ```npm install```

## Fonctionnalités

- 🤖 Bot Discord avec LLM (Ollama)
- 💬 Mémoire conversationnelle globale avec sliding window
- 🖼️ Analyse d'images (GIF, JPG, PNG, WebP)
- 🔍 Recherche web contextuelle
- 👥 **Système de profils utilisateurs avancé**
    - 🧠 Extraction automatique d'informations (function calling)
    - 📊 Scoring d'importance (0-10)
    - 🎯 Système de crédibilité (self/other/inferred)
    - 💾 Stockage persistant
- 📝 Mode passif - L'IA voit tous les messages et garde les conversations importantes en mémoire
- 🧵 Support des threads Discord
- 🌤️ **Canal vocal météo** - Affichage en temps réel de la météo de Sherbrooke (en haut du serveur)

## Commandes

### Gestion de la mémoire et des profils

- `/reset` - 🔴 Efface **TOUT** : mémoire de conversation + profils utilisateurs
- `/reset-memory` - 💬 Efface **uniquement** la mémoire de conversation (garde les profils)
- `/reset-profiles` - 👥 Efface **uniquement** les profils utilisateurs (garde la mémoire)

### Autres commandes

- `/stop` - Arrête la réponse en cours
- `/profile [user]` - Affiche le profil d'un utilisateur
- `/note <user> <type> <content>` - Ajoute manuellement une note sur un utilisateur
- `/forget-profile [user]` - Supprime le profil d'un utilisateur spécifique

## Documentation

- [Système de profils utilisateurs](USER_PROFILES_SYSTEM.md)
- [Guide d'utilisation rapide](QUICK_START_PROFILES.md)
- [Extraction automatique complète](AUTOMATIC_EXTRACTION_COMPLETE.md)

## Comment ça fonctionne

L'IA peut maintenant **apprendre automatiquement** des informations sur les utilisateurs pendant les conversations :

- Quand vous dites "J'adore les jeux rétro", l'IA l'enregistre automatiquement
- Les informations auto-déclarées sont très fiables (confiance 100%)
- Les informations de tiers sont moins fiables (confiance 60%)
- Les faits sont scorés par importance et priorisés intelligemment

