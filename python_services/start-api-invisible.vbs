' Script VBScript pour démarrer l'API Python complètement en arrière-plan
' Aucune fenêtre ne sera visible - le processus tourne invisiblement

Set objShell = CreateObject("WScript.Shell")

' Démarrer le script PowerShell en mode complètement caché (0 = invisible)
' Le 0 signifie : pas de fenêtre du tout
objShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\samyl\OneDrive\Documents\GitHub\discord-bot-llm\python_services\start-api.ps1""", 0, False

' False = ne pas attendre la fin du script (lancer en arrière-plan)

