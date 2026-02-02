# Script de Vérification - Installation Génération d'Images
# Lance ce script pour vérifier que tout est bien installé

Write-Host ""
Write-Host "🔍 VÉRIFICATION DE L'INSTALLATION - GÉNÉRATION D'IMAGES" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Test 1 : Python
Write-Host "📌 Test 1/7 : Python 3.11..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.11") {
        Write-Host "   ✅ Python 3.11 trouvé : $pythonVersion" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Mauvaise version de Python : $pythonVersion" -ForegroundColor Red
        Write-Host "      → Installe Python 3.11.X depuis python.org" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   ❌ Python non trouvé" -ForegroundColor Red
    Write-Host "      → Installe Python 3.11 et coche 'Add to PATH'" -ForegroundColor Yellow
    $allGood = $false
}

# Test 2 : CUDA
Write-Host ""
Write-Host "📌 Test 2/7 : CUDA Toolkit..." -ForegroundColor Yellow
try {
    $cudaVersion = nvcc --version 2>&1 | Select-String "release"
    if ($cudaVersion) {
        Write-Host "   ✅ CUDA trouvé : $cudaVersion" -ForegroundColor Green
    } else {
        Write-Host "   ❌ CUDA non trouvé" -ForegroundColor Red
        Write-Host "      → Installe CUDA Toolkit depuis developer.nvidia.com" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   ❌ CUDA non trouvé" -ForegroundColor Red
    Write-Host "      → Installe CUDA Toolkit depuis developer.nvidia.com" -ForegroundColor Yellow
    $allGood = $false
}

# Test 3 : GPU NVIDIA
Write-Host ""
Write-Host "📌 Test 3/7 : GPU NVIDIA..." -ForegroundColor Yellow
try {
    $gpuInfo = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
    if ($gpuInfo -match "NVIDIA") {
        Write-Host "   ✅ GPU trouvé : $gpuInfo" -ForegroundColor Green
    } else {
        Write-Host "   ❌ GPU NVIDIA non trouvé" -ForegroundColor Red
        Write-Host "      → Vérifie que tu as une carte NVIDIA installée" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   ❌ nvidia-smi non accessible" -ForegroundColor Red
    Write-Host "      → Installe les pilotes NVIDIA depuis geforce.com" -ForegroundColor Yellow
    $allGood = $false
}

# Test 4 : PyTorch
Write-Host ""
Write-Host "📌 Test 4/7 : PyTorch..." -ForegroundColor Yellow
try {
    $torchInstalled = python -c "import torch; print('OK')" 2>&1
    if ($torchInstalled -match "OK") {
        Write-Host "   ✅ PyTorch installé" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PyTorch non trouvé" -ForegroundColor Red
        Write-Host "      → Installe PyTorch avec : pip install torch torchvision --index-url ..." -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   ❌ PyTorch non trouvé" -ForegroundColor Red
    $allGood = $false
}

# Test 5 : PyTorch CUDA Support
Write-Host ""
Write-Host "📌 Test 5/7 : PyTorch CUDA Support..." -ForegroundColor Yellow
try {
    $cudaAvailable = python -c "import torch; print(torch.cuda.is_available())" 2>&1
    if ($cudaAvailable -match "True") {
        Write-Host "   ✅ CUDA disponible pour PyTorch" -ForegroundColor Green
    } else {
        Write-Host "   ❌ CUDA non disponible pour PyTorch" -ForegroundColor Red
        Write-Host "      → Réinstalle PyTorch avec support CUDA" -ForegroundColor Yellow
        Write-Host "      → Ou redémarre ton PC" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   ❌ Erreur lors du test CUDA" -ForegroundColor Red
    $allGood = $false
}

# Test 6 : Dossier python_services
Write-Host ""
Write-Host "📌 Test 6/7 : Microservice..." -ForegroundColor Yellow
$pythonServicesPath = ".\python_services"
if (Test-Path $pythonServicesPath) {
    Write-Host "   ✅ Dossier python_services trouvé" -ForegroundColor Green

    # Vérifier requirements.txt
    $reqPath = "$pythonServicesPath\requirements.txt"
    if (Test-Path $reqPath) {
        Write-Host "   ✅ requirements.txt présent" -ForegroundColor Green
    } else {
        Write-Host "   ❌ requirements.txt manquant" -ForegroundColor Red
        $allGood = $false
    }

    # Vérifier API file
    $apiPath = "$pythonServicesPath\image_generation_api.py"
    if (Test-Path $apiPath) {
        Write-Host "   ✅ image_generation_api.py présent" -ForegroundColor Green
    } else {
        Write-Host "   ❌ image_generation_api.py manquant" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "   ❌ Dossier python_services non trouvé" -ForegroundColor Red
    Write-Host "      → Es-tu dans le bon dossier ?" -ForegroundColor Yellow
    $allGood = $false
}

# Test 7 : Script de démarrage
Write-Host ""
Write-Host "📌 Test 7/7 : Script de démarrage..." -ForegroundColor Yellow
if (Test-Path ".\start-image-service.ps1") {
    Write-Host "   ✅ start-image-service.ps1 trouvé" -ForegroundColor Green
} else {
    Write-Host "   ❌ start-image-service.ps1 manquant" -ForegroundColor Red
    $allGood = $false
}

# Résumé
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "🎊 TOUT EST BON ! TU PEUX DÉMARRER LE MICROSERVICE 🎊" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour démarrer :" -ForegroundColor Cyan
    Write-Host "   .\start-image-service.ps1" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ CERTAINS TESTS ONT ÉCHOUÉ" -ForegroundColor Red
    Write-Host ""
    Write-Host "Consulte le manuel d'installation :" -ForegroundColor Yellow
    Write-Host "   MANUEL_INSTALLATION_IMAGES.md (Guide complet)" -ForegroundColor White
    Write-Host "   QUICK_START_IMAGES.md (Guide rapide)" -ForegroundColor White
    Write-Host ""
}

# Informations supplémentaires
Write-Host "ℹ️  Informations Système :" -ForegroundColor Cyan
Write-Host "   OS: $([System.Environment]::OSVersion.VersionString)" -ForegroundColor Gray
Write-Host "   RAM: $([Math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)) GB" -ForegroundColor Gray

Write-Host ""
Write-Host "Appuie sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
