$botPath = "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm"
$startScript = "$botPath\start-bot.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "DiscordBotAutostart" -Action $action -Trigger $trigger -Settings $settings -Force
