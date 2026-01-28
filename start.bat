@echo off
echo ============================================
echo   Demarrage du Bot Discord avec Profils
echo ============================================
echo.

echo [1/3] Verification de l'environnement...
if not exist "node_modules\" (
    echo ERROR: node_modules manquant. Executez 'npm install' d'abord.
    pause
    exit /b 1
)

if not exist ".env" (
    echo ERROR: Fichier .env manquant. Creez-le avec vos tokens Discord.
    pause
    exit /b 1
)

if not exist "data\profiles\" (
    echo Creation du dossier profiles...
    mkdir "data\profiles"
)

echo [2/3] Compilation TypeScript...
call tsc
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Compilation echouee.
    pause
    exit /b 1
)

echo [3/3] Demarrage du bot...
echo.
echo ============================================
echo   Bot en ligne ! Appuyez sur Ctrl+C pour arreter
echo ============================================
echo.

node dist/bot.js

pause
