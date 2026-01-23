$botPath = "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm"
Start-Process -FilePath "node" -ArgumentList "dist/bot.js" -WorkingDirectory $botPath -WindowStyle Hidden
