# Script pour arrêter Netricsa et le microservice de génération d'images

Write-Host "🛑 Arrêt de Netricsa..." -ForegroundColor Cyan
Write-Host ""

# Arrêter le bot Discord (Node.js)
Write-Host "🤖 Arrêt du bot Discord..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Where-Object { $_.Path -like "*discord-bot-llm*" } | Stop-Process -Force
    Write-Host "   ✅ Bot Discord arrêté" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Bot Discord non actif" -ForegroundColor Gray
}

Write-Host ""

# Arrêter le microservice Python
Write-Host "🎨 Arrêt du microservice de génération d'images..." -ForegroundColor Yellow
$pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue
if ($pythonProcesses) {
    $pythonProcesses | Where-Object { $_.CommandLine -like "*image_generation_api*" } | Stop-Process -Force
    Write-Host "   ✅ Microservice arrêté" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Microservice non actif" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Tous les services sont arrêtés" -ForegroundColor Green
Write-Host ""
