# Script pour télécharger les logos des plateformes

$LOGOS_DIR = "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\assets\store_logos"

Write-Host "📥 Téléchargement des logos des plateformes..." -ForegroundColor Cyan
Write-Host ""

# Steam
Write-Host "⬇️ Steam..." -ForegroundColor Yellow
try
{
    Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png" -OutFile "$LOGOS_DIR\steam.png"
    Write-Host "   ✅ Steam téléchargé" -ForegroundColor Green
}
catch
{
    Write-Host "   ❌ Échec" -ForegroundColor Red
}

# GOG
Write-Host "⬇️ GOG..." -ForegroundColor Yellow
try
{
    Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/GOG.com_logo.svg/512px-GOG.com_logo.svg.png" -OutFile "$LOGOS_DIR\gog.png"
    Write-Host "   ✅ GOG téléchargé" -ForegroundColor Green
}
catch
{
    Write-Host "   ❌ Échec" -ForegroundColor Red
}

# Origin
Write-Host "⬇️ Origin..." -ForegroundColor Yellow
try
{
    Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Origin.svg/512px-Origin.svg.png" -OutFile "$LOGOS_DIR\origin.png"
    Write-Host "   ✅ Origin téléchargé" -ForegroundColor Green
}
catch
{
    Write-Host "   ❌ Échec" -ForegroundColor Red
}

Write-Host ""
Write-Host "ℹ️ Pour les logos manquants, veuillez les télécharger manuellement :" -ForegroundColor Cyan
Write-Host ""
Write-Host "Epic Games:" -ForegroundColor Yellow
Write-Host "  https://www.epicgames.com/site/en-US/about"
Write-Host "  Sauvegardez sous: $LOGOS_DIR\epic.png"
Write-Host ""
Write-Host "Humble Bundle:" -ForegroundColor Yellow
Write-Host "  https://www.humblebundle.com/"
Write-Host "  Sauvegardez sous: $LOGOS_DIR\humble.png"
Write-Host ""
Write-Host "Ubisoft:" -ForegroundColor Yellow
Write-Host "  https://www.ubisoft.com/"
Write-Host "  Sauvegardez sous: $LOGOS_DIR\ubisoft.png"
Write-Host ""
Write-Host "itch.io:" -ForegroundColor Yellow
Write-Host "  https://itch.io/"
Write-Host "  Sauvegardez sous: $LOGOS_DIR\itch.png"
Write-Host ""
Write-Host "Prime Gaming:" -ForegroundColor Yellow
Write-Host "  https://gaming.amazon.com/"
Write-Host "  Sauvegardez sous: $LOGOS_DIR\prime.png"
Write-Host ""
Write-Host "Logo par défaut:" -ForegroundColor Yellow
Write-Host "  Créez une image générique ou copiez un logo existant"
Write-Host "  Sauvegardez sous: $LOGOS_DIR\default.png"
Write-Host ""

Write-Host "✅ Script terminé !" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Logos téléchargés dans: $LOGOS_DIR" -ForegroundColor Cyan
Write-Host ""

Read-Host "Appuyez sur Entrée pour fermer"

