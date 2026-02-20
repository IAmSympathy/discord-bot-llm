# Store Logos

Ce dossier contient les logos des différentes plateformes de jeux pour les notifications FreeStuff.

## Logos requis (format PNG, 512x512 ou circulaires)

- `steam.png` - Logo Steam (bleu/gris)
- `epic.png` - Logo Epic Games Store (noir/blanc)
- `gog.png` - Logo GOG (violet)
- `humble.png` - Logo Humble Bundle (rouge)
- `origin.png` - Logo Origin (orange)
- `ubisoft.png` - Logo Ubisoft Connect (bleu)
- `itch.png` - Logo itch.io (rouge)
- `prime.png` - Logo Prime Gaming (bleu Amazon)
- `default.png` - Logo par défaut (icône générique)

## Où télécharger les logos

1. **Steam**: https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg
2. **Epic Games**: https://www.epicgames.com/site/en-US/about (Presskit)
3. **GOG**: https://www.gog.com/press
4. **Humble Bundle**: https://www.humblebundle.com/press
5. **Origin**: https://www.ea.com/brand
6. **Ubisoft**: https://www.ubisoft.com/en-us/company/press
7. **itch.io**: https://itch.io/press-kit
8. **Prime Gaming**: https://press.aboutamazon.com/

## Alternative rapide

Vous pouvez utiliser ces commandes PowerShell pour télécharger des versions simplifiées :

```powershell
# Steam
Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png" -OutFile "steam.png"

# Epic Games
Invoke-WebRequest -Uri "https://cdn2.unrealengine.com/Epic+Games+Node%2Fxlarge_whitelogo_epicgames_504x512_1529964470588-503x512-ac795e81c54b27aaa2e196456dd307bfe4ca3c49.jpg" -OutFile "epic.png"

# GOG
Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/GOG.com_logo.svg/512px-GOG.com_logo.svg.png" -OutFile "gog.png"

# Humble Bundle
Invoke-WebRequest -Uri "https://hb.imgix.net/fec566de2b11fbe22a542086fb3758652f790551.png?auto=compress,format&fit=crop&h=512&w=512" -OutFile "humble.png"

# Origin
Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Origin.svg/512px-Origin.svg.png" -OutFile "origin.png"

# Default
Invoke-WebRequest -Uri "https://cdn-icons-png.flaticon.com/512/2965/2965358.png" -OutFile "default.png"
```

## Format recommandé

- Format: PNG avec transparence
- Taille: 512x512 pixels ou circulaire
- Fond: Transparent ou adapté à l'embed Discord sombre

---

*Dernière mise à jour: 2026-02-19*

