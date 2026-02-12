# Script de démarrage automatique de l'API Python pour génération d'images
# Ce script démarre l'API avec uvicorn sur le port 8000, accessible depuis internet

# Changer vers le répertoire de l'API
Set-Location -Path "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services"

# Démarrer l'API uvicorn en mode production EN ARRIÈRE-PLAN
# --host 0.0.0.0 permet l'accès depuis internet (nécessaire pour Oracle Cloud)
# --port 8000 est le port par défaut
# Start-Process démarre le processus en arrière-plan sans bloquer
Start-Process -FilePath "C:\Users\samyl\venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "image_generation_api:app", "--host", "0.0.0.0", "--port", "8000" `
    -WorkingDirectory "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services" `
    -WindowStyle Hidden

# Le script se termine immédiatement et le processus Python continue en arrière-plan

