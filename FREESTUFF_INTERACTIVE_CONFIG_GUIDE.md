# 🎛️ Guide de Configuration Interactive - Jeux Gratuits

## ✅ Nouvelle fonctionnalité ajoutée !

Une **commande interactive complète** pour configurer facilement tous les filtres de notifications de jeux gratuits !

---

## 🎮 Commande : `/configure-free-games`

### Accès

- **Permissions requises :** Administrateur
- **Localisation :** Disponible dans tous les salons du serveur

### Description

Cette commande ouvre un panneau de configuration interactif avec des menus déroulants et des boutons pour personnaliser précisément les notifications de jeux gratuits que vous souhaitez recevoir.

---

## 🎨 Interface Interactive

Lorsque vous utilisez `/configure-free-games`, un embed s'affiche avec :

### 📊 Affichage de la configuration actuelle

```
⚙️ Configuration - Notifications Jeux Gratuits

🎮 Types de produits
🎮 game

📢 Types d'offres
💎 keep

🏪 Plateformes
Toutes les plateformes

⭐ Note minimale
Désactivé
```

### 🎛️ 3 Menus déroulants interactifs

#### 1️⃣ **Types de produits** (1-9 sélections)

- 🎮 **Jeux** - Jeux complets gratuits ✅ (Par défaut)
- 📦 **DLC** - Extensions et contenus additionnels
- 🎁 **Butin** - Game Pass, Prime Gaming, etc.
- 💿 **Logiciels** - Programmes et outils
- 🎨 **Art** - Assets artistiques
- 🎵 **OST** - Bandes sonores
- 📚 **Livres** - Livres numériques
- 🛒 **Articles** - Articles de boutique
- ✨ **Autres** - Autres types

#### 2️⃣ **Types d'offres** (1-7 sélections)

- 💎 **À conserver** - Jeux à garder définitivement ✅ (Par défaut)
- ⏱️ **Temporaire** - Accès temporaire uniquement
- 👑 **Prime Gaming** - Amazon Prime Gaming
- 🎯 **Game Pass** - Xbox Game Pass
- 📱 **Mobile** - Jeux mobiles
- 📰 **Actualités** - News et annonces
- ❓ **Autres** - Autres types d'offres

#### 3️⃣ **Plateformes** (1-9 sélections)

- 🎮 **Steam** - Steam Store ✅ (Par défaut)
- 🏪 **Epic Games** - Epic Games Store ✅
- 🦅 **GOG** - GOG.com ✅
- 📦 **Humble** - Humble Bundle ✅
- 🔶 **Origin** - EA Origin ✅
- 🎯 **Ubisoft** - Ubisoft Connect ✅
- 🕹️ **itch.io** - itch.io indie games ✅
- 👑 **Prime** - Prime Gaming ✅
- ❓ **Autres** - Autres plateformes ✅

### 🔘 3 Boutons d'action

1. **⭐ Note min: X/5** - Cycle entre 0, 1, 2, 3, 4, 5
    - Filtre les jeux avec une note inférieure
    - Par défaut : Désactivé (0)

2. **🔄 Réinitialiser** - Restaure les paramètres par défaut
    - Types : `game` uniquement
    - Offres : `keep` uniquement
    - Plateformes : Toutes
    - Note : Désactivé

3. **💾 Sauvegarder** - Enregistre la configuration
    - Applique immédiatement les nouveaux filtres
    - Ferme le panneau de configuration

---

## 📋 Configuration par défaut

```json
{
  "allowedTypes": ["game"],
  "allowedChannels": ["keep"],
  "minRating": 0,
  "allowedStores": [
    "steam", "epic", "gog", "humble", 
    "origin", "ubi", "itch", "prime", "other"
  ]
}
```

**Résultat :** Notifications uniquement pour les **jeux complets gratuits à conserver définitivement**, sur **toutes les plateformes**, sans filtre de note.

---

## 🎯 Exemples de configuration

### Exemple 1 : Jeux Steam/Epic uniquement

```
Types de produits: game
Types d'offres: keep
Plateformes: steam, epic
Note min: Désactivé
```

→ Seulement les jeux gratuits Steam et Epic à conserver

### Exemple 2 : Prime Gaming complet

```
Types de produits: game, loot
Types d'offres: prime
Plateformes: prime
Note min: Désactivé
```

→ Tous les jeux et butins Prime Gaming

### Exemple 3 : Jeux de qualité uniquement

```
Types de produits: game
Types d'offres: keep, timed
Plateformes: steam, epic, gog
Note min: 3/5
```

→ Jeux avec note ≥ 3/5 sur Steam, Epic et GOG

### Exemple 4 : Tout sauf DLC

```
Types de produits: game, loot, software
Types d'offres: keep, prime, gamepass
Plateformes: Toutes
Note min: Désactivé
```

→ Jeux, butins et logiciels, mais pas de DLC

---

## 🔄 Utilisation

### Étape 1 : Ouvrir le panneau

```
/configure-free-games
```

### Étape 2 : Sélectionner dans les menus

- Cliquez sur chaque menu déroulant
- Sélectionnez les options souhaitées (multi-sélection)
- L'affichage se met à jour automatiquement

### Étape 3 : Ajuster la note (optionnel)

- Cliquez sur le bouton "⭐ Note min"
- Chaque clic augmente de 1 (0→1→2→3→4→5→0)

### Étape 4 : Sauvegarder

- Cliquez sur "💾 Sauvegarder"
- Un message de confirmation s'affiche
- Les nouveaux filtres sont actifs immédiatement

---

## 📁 Fichier de configuration

**Emplacement :** `data/free_games_config.json`

**Format :**

```json
{
  "allowedTypes": ["game", "dlc"],
  "allowedChannels": ["keep", "prime"],
  "minRating": 3,
  "allowedStores": ["steam", "epic", "gog"]
}
```

**Note :** Modifiable manuellement si besoin, mais la commande est plus pratique !

---

## 🔍 Logs de filtrage

Quand un produit est filtré, le bot log la raison :

```
[FreeGamesService] Skipping dlc: Super Game DLC (allowed: game)
[FreeGamesService] Skipping timed offer: Trial Game (allowed: keep)
[FreeGamesService] Skipping origin store: EA Game (allowed: steam, epic)
[FreeGamesService] Skipping low rated product: Bad Game (rating: 2, min: 3)
```

Utile pour le debug !

---

## ⏱️ Timeout

Le panneau de configuration reste actif pendant **5 minutes**.

Après ce délai, les boutons et menus ne répondent plus. Relancez simplement la commande pour rouvrir le panneau.

---

## 🛡️ Sécurité

- Seul l'utilisateur qui a lancé la commande peut modifier la configuration
- Les autres utilisateurs reçoivent un message d'erreur s'ils essaient d'interagir
- Permissions administrateur requises

---

## 🎉 Résumé

| Configuration | Avant                      | Après                   |
|---------------|----------------------------|-------------------------|
| **Méthode**   | Édition manuelle du `.env` | `/configure-free-games` |
| **Interface** | Fichier texte              | Embed interactif        |
| **Filtres**   | Variable unique            | 4 types de filtres      |
| **Facilité**  | ⭐⭐                         | ⭐⭐⭐⭐⭐                   |
| **Temps**     | 5 minutes                  | 30 secondes             |

---

## 📝 Réponses aux questions

### Q : Dois-je mettre quelque chose dans le `.env` ?

**R :** Non ! La configuration est maintenant gérée par le fichier `free_games_config.json` et la commande interactive.

### Q : Puis-je avoir uniquement les jeux "keep" ?

**R :** Oui ! C'est même la configuration par défaut. Dans le menu "Types d'offres", sélectionnez uniquement "💎 À conserver".

### Q : Comment exclure les DLC ?

**R :** Dans le menu "Types de produits", sélectionnez uniquement "🎮 Jeux" (ne cochez pas 📦 DLC).

### Q : Puis-je filtrer par plateforme ?

**R :** Absolument ! Utilisez le menu "Plateformes" pour ne garder que Steam, Epic, etc.

### Q : La configuration est-elle persistante ?

**R :** Oui ! Elle est sauvegardée dans `data/free_games_config.json` et survit aux redémarrages.

### Q : REST API Key ou Public Key ?

**R :** **REST API Key** dans le `.env`. La Public Key n'est pas nécessaire pour le moment.

---

## 🚀 Prêt à utiliser !

1. Mettez votre **REST API Key** dans `.env`
2. Configurez le **webhook** sur le dashboard FreeStuff
3. Utilisez `/configure-free-games` pour personnaliser
4. Profitez des notifications filtrées ! 🎮

**C'est tout ! Plus simple, plus rapide, plus intuitif !** ✨

