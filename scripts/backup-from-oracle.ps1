#!/usr/bin/env pwsh
# =============================================================================
# backup-from-oracle.ps1 — Sauvegarde LOCALE depuis l'ancienne instance Oracle
# Usage: .\backup-from-oracle.ps1 -OldIP <IP_ANCIENNE_INSTANCE>
# Exemple: .\backup-from-oracle.ps1 -OldIP 152.70.100.200
#
# Ce script tourne sur ton PC WINDOWS.
# Il télécharge les fichiers critiques de l'ancienne instance Oracle
# vers C:\OracleBackup\ avant de créer la nouvelle instance ARM.
# =============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$OldIP,

    [string]$SshKey = "$env:USERPROFILE\.ssh\id_rsa",
    [string]$RemoteUser = "ubuntu",
    [string]$BackupDir = "C:\OracleBackup"
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================="
Write-Host " Sauvegarde Oracle → PC Local"
Write-Host " Source : $RemoteUser@$OldIP"
Write-Host " Destination : $BackupDir"
Write-Host "=============================================="

# ── Vérifier que ssh est disponible
if (-not (Get-Command ssh -ErrorAction SilentlyContinue))
{
    Write-Error "ssh n'est pas installé. Installe OpenSSH via : Settings > Apps > Optional Features > OpenSSH Client"
    exit 1
}

# ── Créer les dossiers de sauvegarde
$folders = @(
    "$BackupDir\discord-bot-llm",
    "$BackupDir\lavalink",
    "$BackupDir\nexa-bot",
    "$BackupDir\potoken-gen",
    "$BackupDir\yt-cipher"
)
foreach ($f in $folders)
{
    New-Item -ItemType Directory -Force -Path $f | Out-Null
}

Write-Host ""
Write-Host "[1/6] Test de connexion à l'ancienne machine..."
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" "echo 'Connexion OK && uname -m && free -h'"

# ── Fonction helper pour scp
function Scp-From
{
    param([string]$Remote, [string]$Local)
    Write-Host "  → $Remote"
    scp -r -o StrictHostKeyChecking=no -i $SshKey "${RemoteUser}@${OldIP}:${Remote}" $Local
}

# ── 2. discord-bot-llm : tout le code source + data (sans node_modules, images générées)
Write-Host ""
Write-Host "[2/6] Sauvegarde discord-bot-llm (code complet + data)..."
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" `
    "tar --exclude='node_modules' --exclude='.git' --exclude='discord-bot-llm/data/generated_images' --exclude='discord-bot-llm/data/temp_images' --exclude='discord-bot-llm/generated_images' --exclude='discord-bot-llm/temp_images' -czf /tmp/discord-bot-llm.tar.gz ~/discord-bot-llm/"
scp -o StrictHostKeyChecking=no -i $SshKey `
    "${RemoteUser}@${OldIP}:/tmp/discord-bot-llm.tar.gz" `
    "$BackupDir\discord-bot-llm\discord-bot-llm.tar.gz"
Write-Host "  ✅ discord-bot-llm complet sauvegardé"

# ── 3. Lavalink (JAR + application.yml + plugins)
Write-Host ""
Write-Host "[3/6] Sauvegarde Lavalink..."
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" `
    "tar -czf /tmp/lavalink.tar.gz ~/lavalink/"
scp -o StrictHostKeyChecking=no -i $SshKey `
    "${RemoteUser}@${OldIP}:/tmp/lavalink.tar.gz" `
    "$BackupDir\lavalink\lavalink.tar.gz"
Write-Host "  ✅ Lavalink sauvegardé"

# ── 4. nexa-bot (tout sauf node_modules, .git, dist)
Write-Host ""
Write-Host "[4/6] Sauvegarde nexa-bot (code complet)..."
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" `
    "tar --exclude='node_modules' --exclude='.git' --exclude='dist' -czf /tmp/nexa-bot.tar.gz ~/nexa-bot/ 2>/dev/null || echo 'skip'"
scp -o StrictHostKeyChecking=no -i $SshKey `
    "${RemoteUser}@${OldIP}:/tmp/nexa-bot.tar.gz" `
    "$BackupDir\nexa-bot\nexa-bot.tar.gz" 2> $null
if ($LASTEXITCODE -ne 0)
{
    Write-Warning "⚠️  nexa-bot non trouvé"
}
else
{
    Write-Host "  ✅ nexa-bot sauvegardé"
}

# ── 5. yt-cipher (tout sauf node_modules, .git)
Write-Host ""
Write-Host "[5/6] Sauvegarde yt-cipher + potoken-gen..."
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" `
    "tar --exclude='node_modules' --exclude='.git' -czf /tmp/yt-cipher.tar.gz ~/yt-cipher/ 2>/dev/null || echo 'skip'"
scp -o StrictHostKeyChecking=no -i $SshKey `
    "${RemoteUser}@${OldIP}:/tmp/yt-cipher.tar.gz" `
    "$BackupDir\yt-cipher\yt-cipher.tar.gz" 2> $null
if ($LASTEXITCODE -ne 0)
{
    Write-Warning "⚠️  yt-cipher non trouvé"
}
else
{
    Write-Host "  ✅ yt-cipher sauvegardé"
}

# potoken-gen (sans node_modules)
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" `
    "tar --exclude='node_modules' --exclude='.git' -czf /tmp/potoken-gen.tar.gz ~/potoken-gen/ 2>/dev/null || echo 'skip'"
scp -o StrictHostKeyChecking=no -i $SshKey `
    "${RemoteUser}@${OldIP}:/tmp/potoken-gen.tar.gz" `
    "$BackupDir\potoken-gen\potoken-gen.tar.gz" 2> $null
if ($LASTEXITCODE -ne 0)
{
    Write-Warning "⚠️  potoken-gen non trouvé"
}
else
{
    Write-Host "  ✅ potoken-gen sauvegardé"
}

# ── 6. Autres dossiers à la racine (hors repos connus)
Write-Host ""
Write-Host "[6/6] État actuel des services PM2 + liste des dossiers home..."
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" "ls -la ~/"
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$OldIP" "pm2 list --no-color 2>/dev/null || echo 'PM2 non disponible'"

Write-Host ""
Write-Host "=============================================="
Write-Host " ✅ Sauvegarde terminée !"
Write-Host ""
Write-Host " Fichiers sauvegardés dans : $BackupDir"
Write-Host ""
Write-Host " Prochaines étapes :"
Write-Host " 1. Créer la nouvelle instance ARM A1 sur Oracle Cloud"
Write-Host " 2. Copier la clé SSH publique dans l'instance"
Write-Host " 3. Lancer : .\restore-to-new-oracle.ps1 -NewIP <IP_NOUVELLE>"
Write-Host " 4. Vérifier que le bot fonctionne"
Write-Host " 5. SUPPRIMER l'ancienne instance"
Write-Host "=============================================="

Get-ChildItem $BackupDir -Recurse -File | Select-Object FullName, @{ N = "Size(MB)"; E = { [math]::Round($_.Length/1MB, 2) } } | Format-Table -AutoSize

