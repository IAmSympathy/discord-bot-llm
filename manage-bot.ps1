param(
    [string]$Command = ""
)

$SSH_KEY = "C:\Users\samyl\Downloads\ssh-key-2026-02-10.key"
$SERVER = "ubuntu@151.145.51.189"
$SSH_OPTS = "-o StrictHostKeyChecking=no -o ConnectTimeout=15"

# ================================
# 🛑 INTERCEPTER CTRL + C (SAFE)
# ================================
[Console]::TreatControlCAsInput = $true

function Invoke-SSH
{
    param([string]$Cmd)
    $expr = "ssh -i `"$SSH_KEY`" $SSH_OPTS $SERVER `"$Cmd`""
    Invoke-Expression $expr
}

function Show-Menu
{
    Clear-Host
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   🤖 Discord Bot Netricsa - Oracle      ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Choisis une option :" -ForegroundColor Yellow
    Write-Host "  1️⃣  📊 Statut (tous les services)"
    Write-Host "  2️⃣  📋 Logs Bot"
    Write-Host "  3️⃣  📋 Logs Lavalink"
    Write-Host "  4️⃣  🔄 Restart Bot uniquement"
    Write-Host "  5️⃣  🔄 Restart Lavalink uniquement"
    Write-Host "  6️⃣  🔄 Restart TOUT (Lavalink + Bot)"
    Write-Host "  7️⃣  ⏸️  Stop TOUT"
    Write-Host "  8️⃣  ▶️  Start TOUT"
    Write-Host "  9️⃣  🚀 Deploy"
    Write-Host "  S   🔐 SSH"
    Write-Host "  0️⃣  ❌ Quitter"
    Write-Host ""
    Read-Host "Entre un numéro"
}

function Pause
{
    Write-Host ""
    Read-Host "Appuie sur Entrée pour revenir au menu"
}

while ($true)
{

    if (-not $Command)
    {
        $choice = Show-Menu
    }
    else
    {
        $choice = $Command
        $Command = ""
    }

    switch ( $choice.ToLower())
    {

        "1" {
            Write-Host "📊 Statut de tous les services..." -ForegroundColor Cyan
            Invoke-SSH "pm2 status"
            Pause
        }

        "2" {
            Write-Host "📋 Logs Bot (Ctrl+C pour quitter)..." -ForegroundColor Cyan
            Invoke-SSH "pm2 logs discord-bot-netricsa --lines 50"
            Pause
        }

        "3" {
            Write-Host "📋 Logs Lavalink (Ctrl+C pour quitter)..." -ForegroundColor Cyan
            Invoke-SSH "pm2 logs lavalink --lines 50"
            Pause
        }

        "4" {
            Write-Host "🔄 Restart Bot..." -ForegroundColor Cyan
            Invoke-SSH "pm2 restart discord-bot-netricsa"
            Write-Host "✅ Bot redémarré !" -ForegroundColor Green
            Pause
        }

        "5" {
            Write-Host "🔄 Restart Lavalink..." -ForegroundColor Cyan
            Invoke-SSH "pm2 restart lavalink"
            Write-Host "✅ Lavalink redémarré !" -ForegroundColor Green
            Pause
        }

        "6" {
            Write-Host "🔄 Restart TOUT (Lavalink d'abord, puis Bot)..." -ForegroundColor Cyan
            Invoke-SSH "pm2 restart lavalink && sleep 5 && pm2 restart discord-bot-netricsa"
            Write-Host "✅ Tout redémarré !" -ForegroundColor Green
            Pause
        }

        "7" {
            Write-Host "⏸️ Stop de tous les services..." -ForegroundColor Cyan
            Invoke-SSH "pm2 stop all"
            Write-Host "⚠️ Tout arrêté." -ForegroundColor Yellow
            Pause
        }

        "8" {
            Write-Host "▶️ Start de tous les services..." -ForegroundColor Cyan
            Invoke-SSH "cd ~/discord-bot-llm && pm2 start ecosystem.config.js"
            Write-Host "✅ Tout démarré !" -ForegroundColor Green
            Pause
        }

        "9" {
            Write-Host "🚀 Deploy..." -ForegroundColor Cyan
            & "$PSScriptRoot\deploy-to-oracle.ps1"
            Pause
        }

        "s" {
            Write-Host "🔐 Connexion SSH (exit pour revenir)..." -ForegroundColor Cyan
            $expr = "ssh -i `"$SSH_KEY`" $SSH_OPTS $SERVER"
            Invoke-Expression $expr
            Pause
        }

        "0" {
            Write-Host "👋 À bientôt !" -ForegroundColor Cyan
            exit
        }

        default {
            Write-Host "❌ Choix invalide." -ForegroundColor Red
            Start-Sleep 1
        }
    }
}
