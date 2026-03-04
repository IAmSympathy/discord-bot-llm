#!/usr/bin/env pwsh
# =============================================================================
# restore-to-new-oracle.ps1 — Restore depuis PC Local → Nouvelle instance ARM
# Usage: .\restore-to-new-oracle.ps1 -NewIP <IP_NOUVELLE_INSTANCE>
# Exemple: .\restore-to-new-oracle.ps1 -NewIP 158.101.200.50
#
# À lancer APRÈS backup-from-oracle.ps1 ET après avoir créé la nouvelle instance.
# =============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$NewIP,

    [string]$SshKey = "C:\Users\samyl\Downloads\ssh-key-2026-03-04.key",
    [string]$RemoteUser = "ubuntu",
    [string]$BackupDir = "C:\OracleBackup"
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================="
Write-Host " Restore PC Local → Nouvelle instance ARM"
Write-Host " Destination : $RemoteUser@$NewIP"
Write-Host " Source : $BackupDir"
Write-Host "=============================================="

if (-not (Test-Path $BackupDir))
{
    Write-Error "Dossier de sauvegarde introuvable : $BackupDir — Lance d'abord backup-from-oracle.ps1"
    exit 1
}

# ── 1. Test connexion
Write-Host ""
Write-Host "[1/8] Test de connexion à la nouvelle machine..."
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$NewIP" "echo 'Connexion OK' && uname -m"

# ── 2. Installation des dépendances système
Write-Host ""
Write-Host "[2/8] Installation des dépendances système (Node.js, Java, Deno, PM2)..."
$setupScript = @'
set -e
export DEBIAN_FRONTEND=noninteractive

echo "→ Mise à jour APT..."
sudo apt-get update -q

echo "→ Paquets système..."
sudo apt-get install -y -q \
    curl wget git unzip build-essential \
    python3 python3-pip cmake \
    ca-certificates gnupg lsb-release \
    libopus-dev libopus0 \
    libtool autoconf automake \
    libvips-dev libffi-dev

echo "→ Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y -q nodejs

echo "→ pnpm + pm2..."
sudo npm install -g pnpm pm2

echo "→ Java 21..."
sudo apt-get install -y -q openjdk-21-jre-headless

echo "→ Deno..."
curl -fsSL https://deno.land/install.sh | sh
echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc

echo "→ Swap 2GB..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
echo "✅ Dépendances OK"
'@
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$NewIP" $setupScript

# ── 3. Clone yt-cipher (pas dans le backup, vient de GitHub)
Write-Host ""
Write-Host "[3/7] Clone yt-cipher depuis GitHub..."
$cloneScript = @'
set -e
if [ -d ~/yt-cipher/.git ]; then
    cd ~/yt-cipher && git pull
else
    rm -rf ~/yt-cipher
    git clone https://github.com/kikkia/yt-cipher.git ~/yt-cipher
fi
echo "✅ yt-cipher cloné"
'@
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$NewIP" $cloneScript

# ── 4. Upload discord-bot-llm (archive complète : src, dist, data, .env*, assets, scripts)
Write-Host ""
Write-Host "[4/7] Upload discord-bot-llm (archive complète)..."

$fullArchive = "$BackupDir\discord-bot-llm\discord-bot-llm-full.tar.gz"
$oldArchive = "$BackupDir\discord-bot-llm\discord-bot-llm.tar.gz"
$archiveToUse = if (Test-Path $fullArchive)
{
    $fullArchive
}
elseif (Test-Path $oldArchive)
{
    $oldArchive
}
else
{
    $null
}

if ($archiveToUse)
{
    scp -o StrictHostKeyChecking=no -i $SshKey `
        "$archiveToUse" `
        "${RemoteUser}@${NewIP}:/tmp/discord-bot-llm-full.tar.gz"
    ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$NewIP" `
        "rm -rf ~/discord-bot-llm && cd ~ && tar -xzf /tmp/discord-bot-llm-full.tar.gz && rm /tmp/discord-bot-llm-full.tar.gz && echo 'Extrait OK'"
    Write-Host "  ✅ discord-bot-llm restauré (src, dist, data, .env*, assets)"
}
else
{
    Write-Error "  ❌ Aucune archive discord-bot-llm trouvée dans $BackupDir\discord-bot-llm\"
}

# ── 5. Upload Lavalink
Write-Host ""
Write-Host "[5/7] Upload Lavalink..."
if (Test-Path "$BackupDir\lavalink\lavalink.tar.gz")
{
    scp -o StrictHostKeyChecking=no -i $SshKey `
        "$BackupDir\lavalink\lavalink.tar.gz" `
        "${RemoteUser}@${NewIP}:/tmp/lavalink.tar.gz"
    ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$NewIP" `
        "cd ~ && tar -xzf /tmp/lavalink.tar.gz && rm /tmp/lavalink.tar.gz"
    Write-Host "  ✅ Lavalink restauré"
}
else
{
    Write-Warning "  ⚠️  lavalink.tar.gz manquant"
}

# ── 6. Upload potoken-gen
Write-Host ""
Write-Host "[6/7] Upload potoken-gen..."
if (Test-Path "$BackupDir\potoken-gen\potoken-gen.tar.gz")
{
    scp -o StrictHostKeyChecking=no -i $SshKey `
        "$BackupDir\potoken-gen\potoken-gen.tar.gz" `
        "${RemoteUser}@${NewIP}:/tmp/potoken-gen.tar.gz"
    ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$NewIP" `
        "cd ~ && tar -xzf /tmp/potoken-gen.tar.gz && rm /tmp/potoken-gen.tar.gz"
    Write-Host "  ✅ potoken-gen restauré"
}

# ── 7. npm install + build + démarrage PM2
Write-Host ""
Write-Host "[7/7] npm install, build et démarrage PM2..."
$startScript = @'
set -e
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"

echo "→ npm install discord-bot-llm..."
cd ~/discord-bot-llm
npm install


echo "→ npm install potoken-gen..."
if [ -d ~/potoken-gen ]; then
    cd ~/potoken-gen && npm install
fi

echo "→ Génération du poToken initial..."
if [ -f ~/potoken-gen/gen2.mjs ]; then
    cd ~/potoken-gen
    RESULT=$(node gen2.mjs 2>/dev/null || echo "")
    if [ -n "$RESULT" ]; then
        NEW_POTOKEN=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('poToken',''))" 2>/dev/null || echo "")
        NEW_VISITOR=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('visitorData',''))" 2>/dev/null || echo "")
        if [ -n "$NEW_POTOKEN" ] && [ -f ~/lavalink/application.yml ]; then
            sed -i "s|poToken: \".*\"|poToken: \"$NEW_POTOKEN\"|" ~/lavalink/application.yml
            sed -i "s|visitorData: \".*\"|visitorData: \"$NEW_VISITOR\"|" ~/lavalink/application.yml
            echo "→ poToken mis à jour"
        fi
    fi
fi

echo "→ Démarrage PM2..."
cd ~/discord-bot-llm
pm2 start ecosystem.config.js 2>/dev/null || true


if [ -f ~/yt-cipher/server.ts ]; then
    pm2 start ~/yt-cipher/server.ts --name yt-cipher \
        --interpreter ~/.deno/bin/deno \
        --interpreter-args "run --allow-net --allow-read --allow-write --allow-env" \
        -- server.ts 2>/dev/null || true
fi

if [ -f ~/potoken-gen/gen2.mjs ]; then
    pm2 start ~/potoken-gen/gen2.mjs --name potoken-renewer --interpreter node 2>/dev/null || true
fi

pm2 save
pm2 startup 2>/dev/null | tail -1 | bash || true

echo "✅ Tout démarré !"
pm2 list
'@
ssh -o StrictHostKeyChecking=no -i $SshKey "$RemoteUser@$NewIP" $startScript

Write-Host ""
Write-Host "=============================================="
Write-Host " ✅ Restore terminé !"
Write-Host ""
Write-Host " Nouvelle instance : $NewIP"
Write-Host ""
Write-Host " Prochaines étapes :"
Write-Host " 1. Tester le bot Discord (commandes, musique, etc.)"
Write-Host " 2. Vérifier les logs : ssh ubuntu@$NewIP 'pm2 logs'"
Write-Host " 3. Si tout fonctionne → SUPPRIMER l'ancienne instance Oracle"
Write-Host " ⚠️  Ne JAMAIS avoir 2 instances en même temps (hors free tier !)"
Write-Host "=============================================="

