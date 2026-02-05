# Script de demarrage automatique pour Netricsa + Microservice d'images
# Compatible Windows PowerShell
# Sauvegarder en UTF-8 sans BOM

$botPath = "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm"
$pythonServicesPath = Join-Path $botPath "python_services"

Write-Host "🚀 Demarrage de Netricsa..." -ForegroundColor Cyan
Write-Host ""

# 1. Demarrer le microservice de generation d'images
Write-Host "🎨 Demarrage du microservice de generation d'images..." -ForegroundColor Yellow

$venvPath = "C:\Users\samyl\venv"

if (Test-Path $venvPath) {
    $pythonExe = "C:\Users\samyl\venv\Scripts\python.exe"
    $apiScript = "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services\image_generation_api.py"


    if ((Test-Path $pythonExe) -and (Test-Path $apiScript)) {
        Write-Host "📍 Lancement : $pythonExe $apiScript" -ForegroundColor Gray
        # Lancer dans cette console pour voir les erreurs
        Start-Process -FilePath $pythonExe -ArgumentList @($apiScript) -WorkingDirectory "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services" -WindowStyle Hidden
        Write-Host "✅ Microservice Python demarre (fenetre normale pour debug)" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Microservice non trouve, verifiez l'installation" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: Environnement virtuel Python non trouve" -ForegroundColor Yellow
    Write-Host "💡 Executez: .\start-bot.ps1" -ForegroundColor Gray
}

Write-Host ""

# 2. Demarrer le bot Discord
Write-Host "🤖 Demarrage du bot Discord..." -ForegroundColor Yellow

$nodeExe = "node"
$botScript = "dist/bot.js"

if (Test-Path (Join-Path $botPath $botScript)) {
    Start-Process -FilePath $nodeExe -ArgumentList @($botScript) -WorkingDirectory $botPath -WindowStyle Hidden
    Write-Host "✅ Bot Discord demarre (fenetre normale pour debug)" -ForegroundColor Green
} else {
    Write-Host "WARNING: Bot Discord non trouve, verifiez que dist/bot.js existe" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✨ Netricsa est maintenant en ligne !" -ForegroundColor Green
Write-Host ""
Write-Host "Pour arreter les services :" -ForegroundColor Cyan
Write-Host "   • Microservice : taskkill /IM python.exe" -ForegroundColor Gray
Write-Host "   • Bot Discord : taskkill /IM node.exe" -ForegroundColor Gray
Write-Host ""
