# Script de déploiement automatique vers le serveur Oracle
# Usage: .\deploy-to-oracle.ps1

$SSH_KEY = "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key"
$SERVER = "ubuntu@151.145.51.189"

Write-Host "🚀 Déploiement vers le serveur Oracle Cloud..." -ForegroundColor Cyan

# 1. Commit et push local (optionnel)
Write-Host "`n📝 Voulez-vous commit et push les changements locaux? (o/n)" -ForegroundColor Yellow
$commit = Read-Host
if ($commit -eq "o")
{
    Write-Host "💬 Message de commit:" -ForegroundColor Yellow
    $message = Read-Host
    git add .
    git commit -m "$message"
    git push origin main
    Write-Host "✅ Code poussé vers GitHub" -ForegroundColor Green
}

# 2. Se connecter au serveur et déployer
Write-Host "`n🔄 Déploiement sur le serveur..." -ForegroundColor Cyan

$commands = @"
cd ~/discord-bot-llm
echo '📥 Récupération des dernières modifications...'
git pull
echo '🔨 Compilation du TypeScript...'
npx tsc
echo '🔄 Redémarrage du bot...'
pm2 restart discord-bot-netricsa
echo '✅ Déploiement terminé!'
echo ''
echo '📊 Statut du bot:'
pm2 status discord-bot-netricsa
echo ''
echo '📋 Derniers logs:'
pm2 logs discord-bot-netricsa --lines 20 --nostream
"@

ssh -i $SSH_KEY $SERVER $commands

Write-Host "`n✅ Déploiement terminé avec succès!" -ForegroundColor Green
Write-Host "🔍 Pour voir les logs en temps réel: ssh -i `"$SSH_KEY`" $SERVER `"pm2 logs discord-bot-netricsa`"" -ForegroundColor Yellow

