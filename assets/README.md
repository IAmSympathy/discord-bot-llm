# 🏆 Assets - Badges d'Achievements

## Image requise

### `achievement_badge.png`

- **Utilisation** : Badge affiché dans les notifications de succès
- **Taille recommandée** : 256x256 pixels ou plus
- **Format** : PNG avec transparence
- **Emplacement** : `assets/achievement_badge.png`

**L'image fournie par l'utilisateur (badge rouge/jaune avec trophée) doit être placée ici.**

Si l'image est manquante, la notification fonctionnera quand même mais sans l'image du badge.

## Comment ajouter l'image

1. Prends l'image du badge (celle avec le trophée noir sur fond jaune/rouge)
2. Renomme-la en `achievement_badge.png`
3. Place-la dans le dossier `assets/` à la racine du projet

Le chemin final doit être :

```
discord-bot-llm/
  ├─ assets/
  │   └─ achievement_badge.png  ← L'image ici
  ├─ src/
  ├─ dist/
  └─ ...
```
