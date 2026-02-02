# 🎨 Microservice de Génération d'Images - Netricsa

Service FastAPI pour la génération et l'upscaling d'images avec Diffusers (HuggingFace).

## 🚀 Démarrage Rapide

```powershell
# Depuis la racine du projet
.\start-image-service.ps1
```

Le service démarre sur **http://localhost:8000**

## 📖 API Endpoints

### GET `/`

Health check et statut des modèles

### POST `/generate`

Génère une image avec Stable Diffusion

**Body :**

```json
{
  "prompt": "a beautiful landscape",
  "negative_prompt": "blurry, low quality",
  "width": 512,
  "height": 512,
  "steps": 30,
  "cfg_scale": 7.5,
  "seed": -1
}
```

### POST `/upscale`

Upscale une image

**Body :**

```json
{
  "image": "base64_encoded_image",
  "method": "esrgan",
  "scale": 4
}
```

### POST `/unload`

Décharge les modèles pour libérer la VRAM

## 🔧 Configuration

### Variables d'environnement

Aucune nécessaire par défaut. Le service utilise :

- Port : 8000
- Device : CUDA si disponible, sinon CPU
- Modèle : Stable Diffusion 1.5

### Optimisations RTX 3060

- ✅ Attention slicing activé
- ✅ Xformers memory efficient attention
- ✅ Float16 precision
- ✅ Lazy loading des modèles

## 📊 Performance

**RTX 3060 (12GB VRAM) :**

- 512x512, 30 steps : ~15-20s
- Real-ESRGAN 4x : ~3-5s

## 🐛 Logs

Les logs s'affichent dans la console :

- 🚀 Démarrage
- 📥 Chargement des modèles
- 🎨 Génération en cours
- ✅ Succès
- ❌ Erreurs

## 📦 Modèles Téléchargés

Les modèles sont téléchargés automatiquement dans :

- Windows : `C:\Users\<user>\.cache\huggingface\`
- Taille : ~4GB pour SD 1.5
