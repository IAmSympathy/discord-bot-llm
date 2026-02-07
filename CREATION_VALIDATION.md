# 🎨 Système de Validation des Créations

## 📋 Résumé

Les posts dans le salon **Création** ne donnent plus d'XP automatiquement. Un système de validation manuelle a été mis en place pour éviter le spam et s'assurer que seules les vraies créations sont récompensées.

---

## 🎯 Fonctionnement

### 1. Un utilisateur poste dans le salon Création

- Netricsa analyse et commente la création (comme avant)
- **Aucun XP n'est donné automatiquement**
- Un message de validation est envoyé dans le salon de logs

### 2. Message de Validation (Logs)

Le message contient :

- Un ping du propriétaire du serveur
- Les détails de la création (auteur, lien, date)
- Le montant d'XP qui sera attribué (**1000 XP**)
- Deux boutons : **✅ Valider** ou **❌ Rejeter**

### 3. Décision du Propriétaire

**Si vous cliquez sur ✅ Valider :**

- L'utilisateur reçoit **1000 XP**
- Une notification de level up est envoyée si applicable
- Le message de validation est mis à jour (boutons retirés, couleur verte)

**Si vous cliquez sur ❌ Rejeter :**

- Aucun XP n'est attribué
- Le message de validation est mis à jour (boutons retirés, couleur rouge)
- L'utilisateur n'est pas notifié

---

## 📁 Fichiers du Système

### Service Principal

**`src/services/creationValidationService.ts`**

- `requestCreationValidation()` - Envoie la demande de validation
- `validateCreation()` - Valide et donne l'XP
- `rejectCreation()` - Rejette sans donner d'XP
- `isCreationValidated()` - Vérifie le statut

### Base de Données

**`data/pending_creations.json`**
Structure :

```json
{
  "threadId": {
    "userId": "...",
    "username": "...",
    "threadId": "...",
    "threadName": "...",
    "messageId": "...",
    "timestamp": 1234567890,
    "validated": false
  }
}
```

### Intégration

**`src/forumThreadHandler.ts`** - Envoie la demande au lieu de donner l'XP  
**`src/bot.ts`** - Gestionnaire des boutons de validation

---

## 🔐 Permissions

Seul le **propriétaire du serveur** (défini dans `OWNER_ID` de `botStateService.ts`) peut valider ou rejeter les créations.

Si quelqu'un d'autre clique sur les boutons, il reçoit un message d'erreur éphémère.

---

## 💡 Avantages

✅ **Empêche le spam** - Validation manuelle requise  
✅ **Contrôle qualité** - Vous décidez ce qui mérite l'XP  
✅ **Persistant** - Les validations en attente survivent au redémarrage du bot  
✅ **Traçable** - Historique complet dans les logs  
✅ **Flexible** - Vous pouvez valider plus tard si occupé

---

## 🛠️ Configuration

### Modifier le montant d'XP

Éditez `src/services/xpSystem.ts` :

```typescript
export const XP_REWARDS = {
    // ...
    postCreation: 1000,  // ← Modifier ici
    // ...
};
```

### Modifier qui peut valider

Par défaut, seul l'owner peut valider. Pour permettre aux modérateurs :

1. Éditez `src/services/creationValidationService.ts`
2. Modifiez la vérification dans `requestCreationValidation()`
3. Importez et utilisez `MODERATOR_ROLE_ID` au lieu de `OWNER_ID`

---

## 📊 Utilisation

### Valider une Création

1. Un post est créé → Vous recevez une notification dans les logs
2. Cliquez sur le lien pour voir la création
3. Évaluez la qualité/pertinence
4. Cliquez sur **✅ Valider** ou **❌ Rejeter**
5. Un message de confirmation apparaît

### Gérer les Validations en Attente

Les validations en attente sont stockées dans `data/pending_creations.json`.

Pour voir les validations en attente :

```powershell
Get-Content data/pending_creations.json | ConvertFrom-Json
```

---

## 🚨 Dépannage

### Le message de validation n'apparaît pas

- Vérifiez que `LOG_CHANNEL_ID` est configuré dans `.env`
- Vérifiez que le bot a les permissions d'écrire dans le salon

### Le bouton ne fonctionne pas

- Vérifiez que vous êtes bien le propriétaire du serveur
- Vérifiez que l'interaction n'a pas expiré (les interactions Discord expirent après 15 minutes)

### L'XP n'est pas donné après validation

- Vérifiez les logs du bot pour voir les erreurs
- Vérifiez que le thread existe toujours

---

## 🔄 Workflow Complet

```
1. Utilisateur poste dans Création
         ↓
2. Netricsa analyse et commente
         ↓
3. Message de validation envoyé dans logs
         ↓
4. Propriétaire reçoit une notification
         ↓
5. Propriétaire clique sur ✅ Valider ou ❌ Rejeter
         ↓
6. Si validé → 1000 XP donnés + notification level up
   Si rejeté → Rien
         ↓
7. Message de validation mis à jour
         ↓
8. État sauvegardé dans pending_creations.json
```

---

## ✅ Résultat

- ✅ **Spam impossible** - Validation manuelle obligatoire
- ✅ **Contrôle total** - Vous décidez de chaque récompense
- ✅ **Récompenses généreuses** - 1000 XP pour une vraie création
- ✅ **Système simple** - Juste deux boutons à cliquer

---

## 📝 Notes

- Les validations persistent même si le bot redémarre
- Une création ne peut être validée qu'une seule fois
- Le système ne supprime pas automatiquement les anciennes validations
- Vous pouvez nettoyer manuellement `pending_creations.json` si nécessaire

---

## 🎉 Prêt à Utiliser !

Le système est actif et prêt. La prochaine fois qu'un utilisateur postera dans le salon Création, vous recevrez une demande de validation dans les logs !
