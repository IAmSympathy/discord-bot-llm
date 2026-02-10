param(
    [string]$Command = ""
)

$SSH_KEY = "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key"
$SERVER  = "ubuntu@151.145.51.189"

# ================================
# 🛑 INTERCEPTER CTRL + C (SAFE)
# ================================
[Console]::TreatControlCAsInput = $true

function Show-Menu {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   🤖 Discord Bot Netricsa - Oracle      ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Choisis une option :" -ForegroundColor Yellow
    Write-Host "  1️⃣  📊 Statut"
    Write-Host "  2️⃣  📋 Logs"
    Write-Host "  3️⃣  🔄 Restart"
    Write-Host "  4️⃣  ⏸️ Stop"
    Write-Host "  5️⃣  ▶️ Start"
    Write-Host "  6️⃣  🚀 Deploy"
    Write-Host "  7️⃣  🔐 SSH"
    Write-Host "  0️⃣  ❌ Quitter"
    Write-Host ""

    Read-Host "Entre un numéro"
}

function Pause {
    Write-Host ""
    Read-Host "Appuie sur Entrée pour revenir au menu"
}

while ($true) {

    if (-not $Command) {
        $choice = Show-Menu
    } else {
        $choice = $Command
        $Command = ""
    }

    switch ($choice) {

        "1" {
            Write-Host "📊 Statut du bot..." -ForegroundColor Cyan
            ssh -i $SSH_KEY $SERVER "pm2 status discord-bot-netricsa"
            Pause
        }

        "2" {
            Write-Host "📋 Logs (Ctrl+C pour quitter)..." -ForegroundColor Cyan
            ssh -i $SSH_KEY $SERVER "pm2 logs discord-bot-netricsa"
            Pause
        }

        "3" {
            Write-Host "🔄 Restart du bot..." -ForegroundColor Cyan
            ssh -i $SSH_KEY $SERVER "pm2 restart discord-bot-netricsa"
            Write-Host "✅ Redémarré !" -ForegroundColor Green
            Pause
        }

        "4" {
            Write-Host "⏸️ Stop du bot..." -ForegroundColor Cyan
            ssh -i $SSH_KEY $SERVER "pm2 stop discord-bot-netricsa"
            Write-Host "⚠️ Arrêté." -ForegroundColor Yellow
            Pause
        }

        "5" {
            Write-Host "▶️ Start du bot..." -ForegroundColor Cyan
            ssh -i $SSH_KEY $SERVER "pm2 start discord-bot-netricsa"
            Write-Host "✅ Démarré !" -ForegroundColor Green
            Pause
        }

        "6" {
            Write-Host "🚀 Deploy..." -ForegroundColor Cyan
            & "$PSScriptRoot\deploy-to-oracle.ps1"
            Pause
        }

        "7" {
            Write-Host "🔐 Connexion SSH (exit pour revenir)..." -ForegroundColor Cyan
            ssh -i $SSH_KEY $SERVER
            Pause
        }

        "0" {
            Write-Host "👋 À bientôt !" -ForegroundColor Cyan
            break
        }

        default {
            Write-Host "❌ Choix invalide." -ForegroundColor Red
            Start-Sleep 1
        }
    }
}
