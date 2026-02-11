@echo off
REM Lance l'API Python pour génération d'images au démarrage de Windows en arrière-plan
REM Ce script appelle le script PowerShell en mode caché (pas de fenêtre visible)

REM Démarrer PowerShell en mode Hidden (complètement invisible)
powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services\start-api.ps1"

