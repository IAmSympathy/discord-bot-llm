# Script pour ouvrir le port 3000 sur le serveur Oracle Cloud

$SSH_KEY = "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key"
$SERVER = "ubuntu@151.145.51.189"

Write-Host "🔧 Configuration du port 3000 pour le webhook FreeStuff" -ForegroundColor Cyan
Write-Host ""

# Vérifier si le port est déjà ouvert
Write-Host "1️⃣ Vérification du statut actuel..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER "sudo iptables -L -n | grep 3000"

Write-Host ""
Write-Host "2️⃣ Ajout de la règle iptables..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER "sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT"

Write-Host ""
Write-Host "3️⃣ Sauvegarde de la configuration..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER "sudo netfilter-persistent save"

Write-Host ""
Write-Host "4️⃣ Vérification finale..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER "sudo iptables -L -n | grep 3000"

Write-Host ""
Write-Host "✅ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "   1. Vérifier que le bot est en ligne : .\manage-bot.ps1 (option 1)"
Write-Host "   2. Tester l'endpoint : Invoke-WebRequest -Uri 'http://151.145.51.189:3000/health'"
Write-Host "   3. Configurer le webhook sur https://dashboard.freestuffbot.xyz/"
Write-Host "   4. URL à utiliser : http://151.145.51.189:3000/webhooks/freestuff"
Write-Host ""

Read-Host "Appuyez sur Entrée pour fermer"

