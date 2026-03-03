#!/usr/bin/env bash
# =============================================================================
# migrate-to-arm.sh — Migration automatique vers Oracle Cloud ARM A1
# Usage: bash migrate-to-arm.sh <NEW_IP>
# Exemple: bash migrate-to-arm.sh 152.70.100.200
#
# Ce script tourne sur l'ANCIENNE machine (AMD x86_64).
# Il copie les fichiers de config/data, puis clone les repos GitHub
# directement sur la nouvelle machine ARM A1.
# =============================================================================

set -e

NEW_IP="$1"
SSH_KEY="$HOME/.ssh/id_rsa"
NEW_USER="ubuntu"
OLD_HOME="/home/ubuntu"

if [ -z "$NEW_IP" ]; then
    echo "Usage: bash migrate-to-arm.sh <NEW_IP>"
    exit 1
fi

SSH_CMD="ssh -o StrictHostKeyChecking=no -i $SSH_KEY $NEW_USER@$NEW_IP"
SCP_CMD="scp -o StrictHostKeyChecking=no -i $SSH_KEY"

echo "=============================================="
echo " Migration vers ARM A1 — $NEW_IP"
echo "=============================================="

# ── 1. Arrêt propre des services sur l'ancienne machine
echo ""
echo "[1/9] Arrêt propre de PM2..."
pm2 stop all || true

# ── 2. Vérifier que la nouvelle machine est accessible
echo ""
echo "[2/9] Test de connexion à la nouvelle machine..."
$SSH_CMD "echo 'Connexion OK'"

# ── 3. Installation des dépendances sur la nouvelle machine
echo ""
echo "[3/9] Installation des dépendances sur ARM A1..."
$SSH_CMD bash << 'REMOTE_SETUP'
set -e
export DEBIAN_FRONTEND=noninteractive

echo "→ Mise à jour APT..."
sudo apt-get update -q

echo "→ Installation des paquets système..."
sudo apt-get install -y -q \
    curl wget git unzip build-essential \
    python3 python3-pip cmake \
    ca-certificates gnupg lsb-release \
    libopus-dev libopus0 \
    libtool autoconf automake \
    libvips-dev libffi-dev

echo "→ Installation de Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y -q nodejs

echo "→ Installation de pnpm..."
sudo npm install -g pnpm pm2

echo "→ Installation de Java 21 (OpenJDK)..."
sudo apt-get install -y -q openjdk-21-jre-headless

echo "→ Installation de Deno..."
curl -fsSL https://deno.land/install.sh | sh
echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
deno --version

echo "→ Création du swap 2GB..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "✅ Dépendances installées"
REMOTE_SETUP

# ── 4. Clone des repos GitHub sur la nouvelle machine
echo ""
echo "[4/9] Clonage des repos GitHub sur ARM A1..."
$SSH_CMD bash << 'REMOTE_CLONE'
set -e

echo "→ Clone discord-bot-llm..."
if [ -d ~/discord-bot-llm/.git ]; then
    cd ~/discord-bot-llm && git pull
else
    rm -rf ~/discord-bot-llm
    git clone https://github.com/IAmSYmpathy/discord-bot-llm.git ~/discord-bot-llm
fi

echo "→ Clone nexa-bot (lavamusic fork)..."
if [ -d ~/nexa-bot/.git ]; then
    cd ~/nexa-bot && git pull
else
    rm -rf ~/nexa-bot
    git clone https://github.com/bongodevs/lavamusic.git ~/nexa-bot
fi

echo "→ Clone yt-cipher..."
if [ -d ~/yt-cipher/.git ]; then
    cd ~/yt-cipher && git pull
else
    rm -rf ~/yt-cipher
    git clone https://github.com/kikkia/yt-cipher.git ~/yt-cipher
fi

echo "✅ Repos clonés"
REMOTE_CLONE

# ── 5. Copie de Lavalink (JAR + config)
echo ""
echo "[5/9] Copie de Lavalink (JAR + application.yml + plugins)..."
rsync -avz --progress \
    -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
    $OLD_HOME/lavalink/ \
    $NEW_USER@$NEW_IP:~/lavalink/

# ── 6. Copie des fichiers de configuration secrets (non versionnés sur git)
echo ""
echo "[6/9] Copie des fichiers de config secrets..."

# discord-bot-llm : .env + data/
rsync -avz --progress \
    --include='.env' \
    --include='data/' \
    --include='data/**' \
    --exclude='data/generated_images/**' \
    --exclude='data/temp_images/**' \
    --exclude='*' \
    -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
    $OLD_HOME/discord-bot-llm/ \
    $NEW_USER@$NEW_IP:~/discord-bot-llm/

# nexa-bot : .env uniquement (la DB sera régénérée)
$SCP_CMD $OLD_HOME/nexa-bot/.env $NEW_USER@$NEW_IP:~/nexa-bot/.env 2>/dev/null \
    || echo "⚠️  Pas de .env dans nexa-bot — à configurer manuellement"

# ── 7. Copie de potoken-gen (pas sur git public)
echo ""
echo "[7/9] Copie de potoken-gen..."
rsync -avz --progress \
    --exclude='node_modules/' \
    -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" \
    $OLD_HOME/potoken-gen/ \
    $NEW_USER@$NEW_IP:~/potoken-gen/

# ── 8. Installation npm + build + démarrage sur la nouvelle machine
echo ""
echo "[8/9] Installation des dépendances npm, build et démarrage..."
$SSH_CMD bash << 'REMOTE_START'
set -e
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"

# discord-bot-llm
echo "→ npm install discord-bot-llm..."
cd ~/discord-bot-llm
npm install
npx tsc --noEmit 2>/dev/null || true   # vérifie la compilation sans émettre

# nexa-bot (lavamusic)
echo "→ pnpm install nexa-bot..."
cd ~/nexa-bot
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo "→ build nexa-bot..."
pnpm run build 2>/dev/null || npm run build 2>/dev/null || true

# yt-cipher
echo "→ deno cache yt-cipher..."
cd ~/yt-cipher
deno cache server.ts 2>/dev/null || true

# potoken-gen
echo "→ npm install potoken-gen..."
cd ~/potoken-gen
npm install

# Génère le poToken pour la nouvelle IP
echo "→ Génération du poToken initial..."
cd ~/potoken-gen
RESULT=$(node gen2.mjs 2>/dev/null)
if [ -n "$RESULT" ]; then
    NEW_POTOKEN=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('poToken',''))" 2>/dev/null || echo "")
    NEW_VISITOR=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('visitorData',''))" 2>/dev/null || echo "")
    if [ -n "$NEW_POTOKEN" ]; then
        sed -i "s|poToken: \".*\"|poToken: \"$NEW_POTOKEN\"|" ~/lavalink/application.yml
        sed -i "s|visitorData: \".*\"|visitorData: \"$NEW_VISITOR\"|" ~/lavalink/application.yml
        echo "→ poToken mis à jour: ${NEW_POTOKEN:0:20}..."
    fi
fi

# Démarre PM2
echo "→ Démarrage PM2..."
cd ~/discord-bot-llm
pm2 start ecosystem.config.js

cd ~/nexa-bot
pm2 start process.json 2>/dev/null || pm2 start dist/index.js --name nexa-bot || true

pm2 start ~/yt-cipher/server.ts --name yt-cipher --interpreter ~/.deno/bin/deno \
    --interpreter-args "run --allow-net --allow-read --allow-write --allow-env" \
    -- server.ts 2>/dev/null || true

pm2 start ~/potoken-gen/gen2.mjs --name potoken-renewer --interpreter node 2>/dev/null || true

pm2 save
pm2 startup | tail -1 | bash || true

echo "✅ Services démarrés"
pm2 list
REMOTE_START

# ── 9. Vérification finale
echo ""
echo "[9/9] Vérification..."
sleep 10
$SSH_CMD "pm2 list --no-color && free -h && uname -m"

echo ""
echo "=============================================="
echo " ✅ Migration terminée !"
echo " Nouvelle IP: $NEW_IP"
echo ""
echo " Prochaines étapes:"
echo " 1. Vérifier les logs : pm2 logs"
echo " 2. Tester le bot Discord"
echo " 3. Supprimer l'ancienne instance AMD une fois validé"
echo "=============================================="
