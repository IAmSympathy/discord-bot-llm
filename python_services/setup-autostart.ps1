# Script pour créer une tâche planifiée Windows qui démarre l'API Python au boot
# À exécuter en tant qu'administrateur

Write-Host "=== Configuration du démarrage automatique de l'API Python ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier si on est administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin)
{
    Write-Host "ERREUR: Ce script doit être exécuté en tant qu'administrateur !" -ForegroundColor Red
    Write-Host "Faites un clic droit sur PowerShell et sélectionnez 'Exécuter en tant qu'administrateur'" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

# Définir les chemins - Utilise VBScript pour démarrage complètement invisible
$scriptPath = "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services\start-api-invisible.vbs"
$taskName = "Discord Bot - Python Image API"
$taskDescription = "Démarre automatiquement l'API Python pour génération d'images au démarrage de Windows en arrière-plan invisible (nécessaire pour le bot Discord sur Oracle Cloud)"

# Vérifier que le script existe
if (-not (Test-Path $scriptPath))
{
    Write-Host "ERREUR: Le script $scriptPath n'existe pas !" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

Write-Host "Création de la tâche planifiée..." -ForegroundColor Yellow

# Supprimer la tâche existante si elle existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask)
{
    Write-Host "Suppression de la tâche existante..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Créer l'action (lancer le script VBS avec wscript)
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$scriptPath`""

# Créer le déclencheur (au démarrage de Windows, avec délai de 30 secondes)
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT30S"  # Délai de 30 secondes pour laisser Windows démarrer

# Créer les paramètres de la tâche
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -DontStopOnIdleEnd `
    -Hidden

# Créer le principal (utilisateur qui exécutera la tâche)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

# Créer et enregistrer la tâche
Register-ScheduledTask `
    -TaskName $taskName `
    -Description $taskDescription `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force

Write-Host ""
Write-Host "✅ Tâche planifiée créée avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "Détails de la tâche :" -ForegroundColor Cyan
Write-Host "  - Nom: $taskName" -ForegroundColor White
Write-Host "  - Script: $scriptPath" -ForegroundColor White
Write-Host "  - Déclencheur: Au démarrage de Windows (délai de 30s)" -ForegroundColor White
Write-Host "  - Utilisateur: $env:USERNAME" -ForegroundColor White
Write-Host "  - Mode: Arrière-plan invisible (pas de fenêtre)" -ForegroundColor White
Write-Host ""
Write-Host "Pour tester la tâche immédiatement, exécutez :" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
Write-Host ""
Write-Host "Pour vérifier que l'API tourne en arrière-plan :" -ForegroundColor Yellow
Write-Host "  Get-Process python -ErrorAction SilentlyContinue" -ForegroundColor White
Write-Host "  Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue" -ForegroundColor White
Write-Host ""
Write-Host "Pour voir la tâche dans le Planificateur de tâches :" -ForegroundColor Yellow
Write-Host "  1. Appuyez sur Win+R" -ForegroundColor White
Write-Host "  2. Tapez: taskschd.msc" -ForegroundColor White
Write-Host "  3. Cherchez '$taskName'" -ForegroundColor White
Write-Host ""

Read-Host "Appuyez sur Entrée pour quitter"

