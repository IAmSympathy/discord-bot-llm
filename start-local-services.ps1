# Script de démarrage automatique des services locaux
# À exécuter sur votre PC Windows

Write-Host "🚀 Démarrage des services pour le bot Discord..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si Ollama est déjà en cours d'exécution
$ollamaProcess = Get-Process -Name "ollama" -ErrorAction SilentlyContinue

if ($ollamaProcess)
{
    Write-Host "✅ Ollama est déjà en cours d'exécution" -ForegroundColor Green
}
else
{
    Write-Host "🔄 Démarrage d'Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Minimized
    Start-Sleep -Seconds 3
    Write-Host "✅ Ollama démarré" -ForegroundColor Green
}

Write-Host ""

# Vérifier si Python API est déjà en cours d'exécution
$pythonPort = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

if ($pythonPort)
{
    Write-Host "✅ Python API est déjà en cours d'exécution" -ForegroundColor Green
}
else
{
    Write-Host "🔄 Démarrage de l'API Python..." -ForegroundColor Yellow

    # Chemin vers le dossier python_services (ajustez selon votre installation)
    $pythonServicesPath = "$PSScriptRoot\python_services"

    if (Test-Path $pythonServicesPath)
    {
        # Démarrer dans une nouvelle fenêtre PowerShell
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pythonServicesPath'; .\venv\Scripts\Activate.ps1; python -m uvicorn image_generation_api:app --host 0.0.0.0 --port 8000"
        Start-Sleep -Seconds 3
        Write-Host "✅ Python API démarrée" -ForegroundColor Green
    }
    else
    {
        Write-Host "❌ Dossier python_services non trouvé: $pythonServicesPath" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📊 État des services :" -ForegroundColor Cyan
Write-Host ""

# Vérifier Ollama
Write-Host "Ollama (port 11434) : " -NoNewline
$ollamaTest = Test-NetConnection -ComputerName localhost -Port 11434 -WarningAction SilentlyContinue
if ($ollamaTest.TcpTestSucceeded)
{
    Write-Host "✅ Actif" -ForegroundColor Green
}
else
{
    Write-Host "❌ Inactif" -ForegroundColor Red
}

# Vérifier Python API
Write-Host "Python API (port 8000) : " -NoNewline
$pythonTest = Test-NetConnection -ComputerName localhost -Port 8000 -WarningAction SilentlyContinue
if ($pythonTest.TcpTestSucceeded)
{
    Write-Host "✅ Actif" -ForegroundColor Green
}
else
{
    Write-Host "❌ Inactif" -ForegroundColor Red
}

Write-Host ""
Write-Host "🌐 Votre IP publique : " -NoNewline
$publicIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content
Write-Host $publicIP -ForegroundColor Yellow

Write-Host ""
Write-Host "✅ Services démarrés ! Le bot sur Oracle Cloud peut maintenant s'y connecter." -ForegroundColor Green
Write-Host ""
Write-Host "💡 Pour tester l'accès externe, utilisez votre smartphone en 4G :" -ForegroundColor Cyan
Write-Host "   http://$publicIP:11434/api/tags" -ForegroundColor White
Write-Host "   http://$publicIP:8000/" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  N'oubliez pas de configurer le port forwarding sur votre routeur !" -ForegroundColor Yellow

