# Fonctionnalité de Déplacement de Messages

## Description

Cette fonctionnalité permet de déplacer des messages d'un salon à un autre tout en conservant l'identité de l'auteur original (nom et photo de profil).

## Utilisation

1. **Faites un clic droit sur un message** (ou appui long sur mobile)
2. Sélectionnez **Applications** → **Déplacer**
3. Un message éphémère (visible uniquement par vous) apparaîtra avec un sélecteur de salon
4. **Choisissez le salon de destination** :
    - Utilisez le **sélecteur** pour les canaux standard
    - OU utilisez le bouton **"📝 Entrer l'ID du canal"** pour saisir manuellement l'ID
        - Utile pour les threads de forum que vous ne suivez pas
        - Pour obtenir l'ID : Clic droit sur le canal → Copier l'identifiant
5. **Types de canaux supportés** :
    - Salons textuels
    - Salons vocaux (discussion textuelle)
    - Salons d'annonces
    - Salons forums
    - Threads publics ou privés
    - Threads d'annonces
6. Le message sera déplacé avec :
    - Le nom et la photo de l'auteur original
    - Le contenu texte
    - Les embeds
    - Les pièces jointes

## Permissions requises

### Pour l'utilisateur :

- **Gérer les messages** - Nécessaire pour utiliser la commande

### Pour le bot :

- **Envoyer des messages** - Dans le salon de destination
- **Gérer les webhooks** - Pour créer/utiliser des webhooks (sauf dans les threads)
- **Gérer les messages** - Pour supprimer le message original

## Fonctionnement technique

La fonctionnalité utilise des **webhooks Discord** pour envoyer le message avec l'identité de l'auteur original. Voici le processus :

1. Le bot crée ou réutilise un webhook nommé "Déplaceur de Messages" dans le salon de destination
2. Le message est envoyé via ce webhook avec le nom et l'avatar de l'auteur original
3. Un message de référence est posté dans le salon source indiquant où le message a été déplacé
4. Le message original est supprimé

## Limitations

- Les **salons de conférence (Stage)** ne sont pas supportés
- Les **messages système** ne peuvent pas être déplacés
- Le bot doit avoir les permissions appropriées dans les deux salons

## Exemples d'utilisation

### Déplacer vers un salon textuel

Parfait pour réorganiser des conversations qui ont dérivé vers un autre sujet.

### Déplacer vers un salon vocal

Utile pour déplacer des messages importants vers la discussion textuelle d'un salon vocal actif. Les membres dans le vocal verront le message dans leur section "Ouvrir la discussion".

### Déplacer vers un forum

Parfait pour créer une nouvelle discussion dans un forum en déplaçant un message. Le message apparaîtra comme un nouveau post dans le forum.

### Déplacer vers un thread

Idéal pour archiver des discussions spécifiques ou créer une FAQ à partir de questions/réponses.

### Déplacer vers un salon d'annonces

Utile pour promouvoir un message important d'un membre de la communauté.

## Notes

- Le message déplacé conserve le contenu, les embeds et les pièces jointes
- Les réactions ne sont pas conservées (limitation de Discord)
- **Aucun message public n'est laissé dans le salon source** - Le déplacement est discret
- La confirmation du déplacement n'est visible que par vous (message éphémère)
- L'action est tracée dans les logs Discord pour les modérateurs

