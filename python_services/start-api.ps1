# Script de démarrage automatique de l'API Python pour génération d'images
# Ce script démarre l'API avec uvicorn sur le port 8000, accessible depuis internet

# Changer vers le répertoire de l'API
Set-Location -Path "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services"

# Activer l'environnement virtuel Python
& "C:\Users\samyl\venv\Scripts\Activate.ps1"

# Démarrer l'API uvicorn en mode production
# --host 0.0.0.0 permet l'accès depuis internet (nécessaire pour Oracle Cloud)
# --port 8000 est le port par défaut
python -m uvicorn image_generation_api:app --host 0.0.0.0 --port 8000

