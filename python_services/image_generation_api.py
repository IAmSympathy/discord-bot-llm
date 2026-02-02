"""
Microservice FastAPI pour la génération et l'upscaling d'images
Utilise Diffusers (HuggingFace) pour Stable Diffusion
Et Real-ESRGAN pour l'upscaling fidèle
"""

import asyncio
import base64
import io
import json
import logging
import numpy as np
import os
import time
import torch
import warnings
from PIL import Image
from diffusers import (
    StableDiffusionXLPipeline,
    StableDiffusionXLImg2ImgPipeline,
    DPMSolverMultistepScheduler
)
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, Literal

# Désactiver les warnings NumPy pour les conversions d'images
warnings.filterwarnings('ignore', category=RuntimeWarning, message='invalid value encountered in cast')

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Netricsa Image Generation API", version="1.0.0")

# Configuration GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.float16 if device == "cuda" else torch.float32

logger.info(f"🚀 Starting API with device: {device}, dtype: {dtype}")

# Activer TensorFloat32 pour meilleure performance sur GPU Ampere (RTX 30xx)
if device == "cuda":
    torch.set_float32_matmul_precision('high')
    logger.info("✅ TensorFloat32 activé pour matmul (meilleure performance)")

# Chargement des modèles au démarrage (lazy loading)
txt2img_pipeline = None
img2img_pipeline = None
esrgan_models = {}  # Dictionnaire pour stocker différents modèles ESRGAN

# Système d'auto-unload après inactivité
last_model_usage = time.time()  # Timestamp du dernier usage
AUTO_UNLOAD_DELAY = 60  # 5 minutes en secondes
auto_unload_task = None  # Task asyncio pour l'auto-unload

# Système d'annulation des jobs
active_jobs = {}  # job_id -> {"cancelled": bool, "type": str}
job_results = {}  # job_id -> {"status": str, "result": dict or error}
job_counter = 0

# Dossier pour les fichiers de flag d'annulation
# Utiliser le chemin absolu basé sur l'emplacement de ce script
SCRIPT_DIR = Path(__file__).parent
CANCEL_FLAGS_DIR = SCRIPT_DIR / "cancel_flags"
CANCEL_FLAGS_DIR.mkdir(exist_ok=True)

logger.info(f"📁 Cancel flags directory: {CANCEL_FLAGS_DIR.absolute()}")


def create_job_id() -> str:
    """Crée un ID unique pour un job"""
    global job_counter
    job_counter += 1
    return f"job_{job_counter}_{int(time.time() * 1000)}"


def is_job_cancelled(job_id: str) -> bool:
    """Vérifie si un job a été annulé en checkant le fichier de flag"""
    # Vérifier d'abord dans active_jobs (méthode HTTP)
    if active_jobs.get(job_id, {}).get("cancelled", False):
        logger.info(f"🛑 Job {job_id} cancelled via active_jobs dict")
        return True

    # Vérifier aussi le fichier de flag (méthode fichier - plus fiable)
    cancel_flag_file = CANCEL_FLAGS_DIR / f"{job_id}.cancel"
    if cancel_flag_file.exists():
        logger.info(f"🛑 Found cancel flag file for job {job_id}: {cancel_flag_file}")
        return True

    # Vérifier aussi un flag global "cancel_all_generate"
    cancel_all_file = CANCEL_FLAGS_DIR / "cancel_all_generate.flag"
    if cancel_all_file.exists():
        job_info = active_jobs.get(job_id, {})
        if job_info.get("type") == "generate":
            logger.info(f"🛑 Found cancel_all_generate flag at {cancel_all_file}, cancelling job {job_id}")
            return True

    return False


def cancel_job(job_id: str) -> bool:
    """Annule un job en cours en créant un fichier de flag"""
    if job_id in active_jobs:
        active_jobs[job_id]["cancelled"] = True
        # Créer aussi un fichier de flag
        cancel_flag_file = CANCEL_FLAGS_DIR / f"{job_id}.cancel"
        cancel_flag_file.touch()
        logger.info(f"🛑 Job {job_id} cancelled (flag file created)")
        return True
    return False


def cancel_all_jobs_of_type(job_type: str) -> int:
    """Annule tous les jobs d'un certain type via un fichier de flag"""
    # Créer un fichier de flag global
    if job_type == "generate" or job_type == "all":
        cancel_all_file = CANCEL_FLAGS_DIR / "cancel_all_generate.flag"
        cancel_all_file.touch()
        logger.info(f"🛑 Created cancel_all_generate flag file")

    # Compter combien de jobs seront annulés
    count = 0
    for job_id, job_info in active_jobs.items():
        if job_info.get("type") == job_type or job_type == "all":
            cancel_job(job_id)
            count += 1

    return count


def cleanup_cancel_flags():
    """Nettoie les anciens fichiers de flag"""
    try:
        for flag_file in CANCEL_FLAGS_DIR.glob("*.cancel"):
            flag_file.unlink()
        for flag_file in CANCEL_FLAGS_DIR.glob("*.flag"):
            flag_file.unlink()
    except Exception as e:
        logger.warning(f"Failed to cleanup cancel flags: {e}")


# Modèle par défaut - Stable Diffusion XL pour qualité maximale
# SDXL produit des images de bien meilleure qualité mais nécessite plus de VRAM (8-10GB)
DEFAULT_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"


# ==================== MODELS PYDANTIC ====================

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = "blurry, low quality, distorted, ugly, bad anatomy, watermark, text, signature, poorly drawn, deformed, disfigured, malformed, mutated, out of frame, cropped, worst quality, jpeg artifacts, duplicate"
    width: Optional[int] = 1024  # SDXL native resolution
    height: Optional[int] = 1024  # SDXL native resolution
    steps: Optional[int] = 40  # SDXL converge plus vite (40 steps suffisent)
    cfg_scale: Optional[float] = 8.0  # SDXL optimal
    seed: Optional[int] = -1
    reference_image: Optional[str] = None  # Base64, pour img2img
    strength: Optional[float] = 0.75  # Force de transformation (0-1)


class UpscaleRequest(BaseModel):
    image: str  # Base64
    scale: Optional[int] = 4  # x4 par défaut avec le modèle x4plus
    model: Optional[str] = "general"  # "general" ou "anime"


# ==================== HELPER FUNCTIONS ====================

def unload_pipeline(pipeline_type: str):
    """Décharge un pipeline spécifique pour libérer la VRAM"""
    global txt2img_pipeline, img2img_pipeline, esrgan_models

    if pipeline_type == "txt2img" and txt2img_pipeline is not None:
        logger.info("🗑️ Unloading txt2img pipeline to free VRAM...")
        del txt2img_pipeline
        txt2img_pipeline = None
        if device == "cuda":
            torch.cuda.empty_cache()
        logger.info("✅ txt2img pipeline unloaded")

    elif pipeline_type == "img2img" and img2img_pipeline is not None:
        logger.info("🗑️ Unloading img2img pipeline to free VRAM...")
        del img2img_pipeline
        img2img_pipeline = None
        if device == "cuda":
            torch.cuda.empty_cache()
        logger.info("✅ img2img pipeline unloaded")

    elif pipeline_type == "esrgan" and len(esrgan_models) > 0:
        logger.info("🗑️ Unloading ESRGAN models to free VRAM...")
        esrgan_models.clear()
        if device == "cuda":
            torch.cuda.empty_cache()
        logger.info("✅ ESRGAN models unloaded")

    elif pipeline_type == "generation":
        # Décharge tous les pipelines de génération (txt2img ET img2img)
        if txt2img_pipeline is not None or img2img_pipeline is not None:
            logger.info("🗑️ Unloading generation pipelines to free VRAM...")
            if txt2img_pipeline is not None:
                del txt2img_pipeline
                txt2img_pipeline = None
            if img2img_pipeline is not None:
                del img2img_pipeline
                img2img_pipeline = None
            if device == "cuda":
                torch.cuda.empty_cache()
            logger.info("✅ Generation pipelines unloaded")


def load_txt2img_pipeline():
    """Charge le pipeline txt2img (lazy loading) et décharge img2img et ESRGAN si nécessaire"""
    global txt2img_pipeline
    if txt2img_pipeline is None:
        # Décharger img2img et ESRGAN s'ils sont chargés pour économiser la VRAM
        unload_pipeline("img2img")
        unload_pipeline("esrgan")

        logger.info("📥 Loading SDXL txt2img pipeline...")
        txt2img_pipeline = StableDiffusionXLPipeline.from_pretrained(
            DEFAULT_MODEL,
            torch_dtype=dtype,
            use_safetensors=True,
            variant="fp16",
            safety_checker=None,
            requires_safety_checker=False
        ).to(device)

        txt2img_pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
            txt2img_pipeline.scheduler.config,
            use_karras_sigmas=True
        )
        logger.info("✅ Scheduler: DPM++ 2M Karras")

        txt2img_pipeline.enable_attention_slicing()
        logger.info("✅ VAE kept in FP16 (same as pipeline)")

        if device == "cuda":
            try:
                txt2img_pipeline.enable_xformers_memory_efficient_attention()
                logger.info("✅ xformers activé (memory efficient attention)")
            except Exception as e:
                logger.warning(f"⚠️ xformers indisponible: {e}")

            logger.info("ℹ️  torch.compile() désactivé (Windows/Triton non disponible)")

        logger.info("✅ SDXL txt2img pipeline loaded")
    return txt2img_pipeline


def load_img2img_pipeline():
    """Charge le pipeline img2img (lazy loading) et décharge txt2img et ESRGAN si nécessaire"""
    global img2img_pipeline
    if img2img_pipeline is None:
        # Décharger txt2img et ESRGAN s'ils sont chargés pour économiser la VRAM
        unload_pipeline("txt2img")
        unload_pipeline("esrgan")

        logger.info("📥 Loading SDXL img2img pipeline...")
        img2img_pipeline = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            DEFAULT_MODEL,
            torch_dtype=dtype,
            use_safetensors=True,
            variant="fp16",
            safety_checker=None,
            requires_safety_checker=False
        ).to(device)

        img2img_pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
            img2img_pipeline.scheduler.config,
            use_karras_sigmas=True
        )
        logger.info("✅ Scheduler: DPM++ 2M Karras")

        img2img_pipeline.enable_attention_slicing()
        logger.info("✅ VAE kept in FP16 (same as pipeline)")

        if device == "cuda":
            try:
                img2img_pipeline.enable_xformers_memory_efficient_attention()
                logger.info("✅ xformers activé (memory efficient attention)")
            except Exception as e:
                logger.warning(f"⚠️ xformers indisponible: {e}")

            logger.info("ℹ️  torch.compile() désactivé (Windows/Triton non disponible)")

        logger.info("✅ SDXL img2img pipeline loaded")
    return img2img_pipeline


def load_esrgan(model_type: str = "general"):
    """
    Charge Real-ESRGAN (lazy loading) et décharge les pipelines de génération si nécessaire

    Args:
        model_type: "general" pour x4plus standard, "anime" pour x4plus_anime_6B
    """
    global esrgan_models

    if model_type not in esrgan_models:
        # Décharger les pipelines de génération pour économiser la VRAM
        unload_pipeline("generation")

        logger.info(f"📥 Loading Real-ESRGAN ({model_type})...")
        try:
            logger.info("Importing basicsr.archs.rrdbnet_arch...")
            from basicsr.archs.rrdbnet_arch import RRDBNet
            logger.info("Importing realesrgan...")
            from realesrgan import RealESRGANer
            logger.info("Imports successful!")

            if model_type == "anime":
                # Configuration pour anime_6B (6 blocks, optimisé pour illustrations/anime)
                model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=6, num_grow_ch=32, scale=4)
                model_path = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth'
                model_name = "x4plus_anime_6B"
            else:  # general
                # Configuration pour x4plus (modèle standard)
                model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
                model_path = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
                model_name = "x4plus"

            # Utiliser le modèle avec paramètres optimisés pour la qualité
            esrgan_models[model_type] = RealESRGANer(
                scale=4,  # x4 scale
                model_path=model_path,
                model=model,
                tile=0,  # Pas de tiling = meilleure qualité (utilise plus de VRAM)
                tile_pad=10,
                pre_pad=10,  # Augmenté pour réduire les artefacts aux bords
                half=True if device == "cuda" else False,
                device=device
            )
            logger.info(f"✅ Real-ESRGAN {model_name} loaded successfully (optimized for quality)")
        except ImportError as e:
            logger.error(f"⚠️ ImportError loading Real-ESRGAN: {e}")
            logger.error(f"Python path: {__file__}")
            import sys
            logger.error(f"sys.path: {sys.path}")
            esrgan_models[model_type] = None
        except Exception as e:
            logger.error(f"❌ Error loading Real-ESRGAN: {e}")
            import traceback
            logger.error(traceback.format_exc())
            esrgan_models[model_type] = None

    return esrgan_models.get(model_type)


def clean_generated_image(image: Image.Image) -> Image.Image:
    """
    Nettoie une image générée pour éviter les valeurs invalides (NaN, Inf)
    qui peuvent causer des warnings lors de la conversion
    """
    # Convertir en numpy array
    img_array = np.array(image)

    # Debug: Afficher les stats de l'image
    logger.info(f"Image array - shape: {img_array.shape}, dtype: {img_array.dtype}, min: {img_array.min()}, max: {img_array.max()}")

    # Vérifier si l'image est vide (toute noire)
    if img_array.max() == 0:
        logger.error("⚠️ Generated image is completely black!")
        return image  # Retourner l'image originale sans modification

    # Si l'image est déjà en uint8, pas besoin de conversion
    if img_array.dtype == np.uint8:
        logger.info("Image already in uint8 format")
        return image

    # Remplacer les NaN et Inf par des valeurs valides
    if np.any(np.isnan(img_array)) or np.any(np.isinf(img_array)):
        logger.warning("⚠️ Detected NaN/Inf values in generated image, cleaning...")
        img_array = np.nan_to_num(img_array, nan=0.0, posinf=255.0, neginf=0.0)

    # Si les valeurs sont entre 0 et 1 (float), convertir en 0-255
    if img_array.max() <= 1.0:
        logger.info("Converting float [0,1] to uint8 [0,255]")
        img_array = (img_array * 255).astype(np.uint8)
    else:
        # S'assurer que les valeurs sont dans la plage [0, 255]
        img_array = np.clip(img_array, 0, 255).astype(np.uint8)

    # Reconvertir en PIL Image
    return Image.fromarray(img_array)


def image_to_base64(image: Image.Image, high_quality: bool = False) -> str:
    """
    Convertit une image PIL en base64

    Args:
        image: Image PIL à convertir
        high_quality: Si True, utilise une compression PNG optimale pour la qualité
    """
    # Nettoyer l'image avant la conversion
    image = clean_generated_image(image)

    buffered = io.BytesIO()
    if high_quality:
        # PNG avec compression minimale pour qualité maximale
        image.save(buffered, format="PNG", compress_level=1, optimize=False)
    else:
        # PNG standard
        image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()


def base64_to_image(base64_str: str) -> Image.Image:
    """Convertit une string base64 en image PIL"""
    image_data = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(image_data))


def update_last_usage():
    """Met à jour le timestamp du dernier usage des modèles"""
    global last_model_usage
    last_model_usage = time.time()
    logger.debug(f"Model usage updated: {last_model_usage}")


async def check_and_unload_models():
    """
    Vérifie périodiquement l'inactivité et décharge les modèles si nécessaire
    Cette fonction tourne en background
    """
    global txt2img_pipeline, img2img_pipeline, esrgan_models, last_model_usage

    while True:
        await asyncio.sleep(60)  # Vérifier toutes les minutes

        # Calculer le temps d'inactivité
        inactive_time = time.time() - last_model_usage

        # Si inactif depuis plus de 5 minutes ET qu'il y a des modèles chargés
        if inactive_time > AUTO_UNLOAD_DELAY:
            models_loaded = (txt2img_pipeline is not None) or (img2img_pipeline is not None) or (len(esrgan_models) > 0)

            if models_loaded:
                logger.info(f"⏰ Models inactive for {inactive_time:.0f}s, auto-unloading...")

                # Décharger txt2img pipeline
                if txt2img_pipeline is not None:
                    del txt2img_pipeline
                    txt2img_pipeline = None
                    logger.info("✅ txt2img_pipeline unloaded")

                # Décharger img2img pipeline
                if img2img_pipeline is not None:
                    del img2img_pipeline
                    img2img_pipeline = None
                    logger.info("✅ img2img_pipeline unloaded")

                # Décharger ESRGAN models
                if esrgan_models:
                    esrgan_models.clear()
                    logger.info("✅ esrgan_models unloaded")

                # Libérer la VRAM
                if device == "cuda":
                    torch.cuda.empty_cache()
                    logger.info("✅ VRAM freed")

                logger.info("🗑️ Auto-unload completed - VRAM freed after inactivity")


def start_auto_unload_task():
    """Démarre la tâche d'auto-unload en background"""
    global auto_unload_task
    if auto_unload_task is None:
        auto_unload_task = asyncio.create_task(check_and_unload_models())
        logger.info("✅ Auto-unload task started (5 min inactivity)")


# ==================== API ENDPOINTS ====================

@app.on_event("startup")
async def startup_event():
    """Événement de démarrage - lance les tâches background"""
    start_auto_unload_task()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Netricsa Image Generation API",
        "status": "online",
        "device": device,
        "models_loaded": {
            "txt2img": txt2img_pipeline is not None,
            "img2img": img2img_pipeline is not None,
            "esrgan_general": "general" in esrgan_models,
            "esrgan_anime": "anime" in esrgan_models
        }
    }


@app.post("/generate")
async def generate_image(request: GenerateRequest):
    """
    Génère une image avec Stable Diffusion (txt2img ou img2img)
    """
    # Mettre à jour le timestamp d'utilisation
    update_last_usage()

    # Créer un job ID pour cette génération
    job_id = create_job_id()
    active_jobs[job_id] = {"cancelled": False, "type": "generate"}

    try:
        logger.info(f"🎨 Generating image (job {job_id}): '{request.prompt[:50]}...'")

        # Callback pour vérifier l'annulation à chaque step
        def callback_on_step_end(pipe, step_index, timestep, callback_kwargs):
            if is_job_cancelled(job_id):
                logger.info(f"🛑 Generation cancelled at step {step_index}")
                raise InterruptedError(f"Job {job_id} was cancelled")
            return callback_kwargs

        # Préparer le seed
        generator = None
        if request.seed != -1:
            generator = torch.Generator(device=device).manual_seed(request.seed)

        # Si image de référence fournie, utiliser img2img
        if request.reference_image:
            logger.info("Using img2img mode with reference image")
            pipeline = load_img2img_pipeline()

            try:
                # Décoder l'image de référence
                logger.info("Decoding reference image from base64...")
                ref_image = base64_to_image(request.reference_image)
                logger.info(f"Reference image decoded - mode: {ref_image.mode}, size: {ref_image.size}")

                # IMPORTANT: Convertir en RGB pour éviter les problèmes avec les PNG (canal alpha)
                if ref_image.mode != "RGB":
                    logger.info(f"Converting image from {ref_image.mode} to RGB")
                    ref_image = ref_image.convert("RGB")
                    logger.info("Conversion to RGB successful")

                # Redimensionner à la taille demandée
                logger.info(f"Resizing image to {request.width}x{request.height}")
                ref_image = ref_image.resize((request.width, request.height))
                logger.info("Resize successful")

            except Exception as e:
                logger.error(f"❌ Error processing reference image: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid reference image: {str(e)}")

            # Générer avec img2img
            logger.info("Starting img2img generation...")
            with torch.inference_mode():
                result = pipeline(
                    prompt=request.prompt,
                    negative_prompt=request.negative_prompt,
                    image=ref_image,
                    strength=request.strength,
                    num_inference_steps=request.steps,
                    guidance_scale=request.cfg_scale,
                    generator=generator,
                    callback_on_step_end=callback_on_step_end
                )
            logger.info("img2img generation completed")
        else:
            # Mode txt2img classique
            logger.info("Using txt2img mode")
            pipeline = load_txt2img_pipeline()

            # Générer l'image
            logger.info(f"Generating with params - width:{request.width}, height:{request.height}, steps:{request.steps}, cfg:{request.cfg_scale}")
            with torch.inference_mode():
                result = pipeline(
                    prompt=request.prompt,
                    negative_prompt=request.negative_prompt,
                    width=request.width,
                    height=request.height,
                    num_inference_steps=request.steps,
                    guidance_scale=request.cfg_scale,
                    generator=generator,
                    callback_on_step_end=callback_on_step_end
                )
            logger.info("txt2img generation completed")

        # Vérifier le résultat
        logger.info(f"Pipeline returned {len(result.images)} image(s)")
        generated_image = result.images[0]
        logger.info(f"Generated image - mode: {generated_image.mode}, size: {generated_image.size}")

        # Convertir en base64
        image_base64 = image_to_base64(generated_image)

        logger.info(f"✅ Image generated successfully")

        # Nettoyer le job de la liste active et les fichiers de flag
        if job_id in active_jobs:
            del active_jobs[job_id]

        # Nettoyer le fichier de flag spécifique
        cancel_flag_file = CANCEL_FLAGS_DIR / f"{job_id}.cancel"
        if cancel_flag_file.exists():
            cancel_flag_file.unlink()

        # Nettoyer le flag global si plus de jobs actifs
        if not any(j.get("type") == "generate" for j in active_jobs.values()):
            cancel_all_file = CANCEL_FLAGS_DIR / "cancel_all_generate.flag"
            if cancel_all_file.exists():
                cancel_all_file.unlink()

        return {
            "success": True,
            "image": image_base64,
            "job_id": job_id,
            "info": {
                "width": result.images[0].width,
                "height": result.images[0].height,
                "steps": request.steps,
                "seed": request.seed if request.seed != -1 else "random",
                "mode": "img2img" if request.reference_image else "txt2img"
            }
        }

    except InterruptedError as e:
        # Job annulé
        logger.info(f"🛑 Job {job_id} was cancelled")
        if job_id in active_jobs:
            del active_jobs[job_id]
        cleanup_cancel_flags()
        raise HTTPException(status_code=499, detail=f"Generation cancelled: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Error generating image: {e}")
        if job_id in active_jobs:
            del active_jobs[job_id]
        cleanup_cancel_flags()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cancel/{job_id}")
async def cancel_generation(job_id: str):
    """
    Annule une génération en cours
    """
    if cancel_job(job_id):
        return {"success": True, "message": f"Job {job_id} cancelled"}
    else:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found or already completed")


@app.post("/cancel-all/{job_type}")
async def cancel_all_jobs(job_type: str):
    """
    Annule tous les jobs d'un certain type via fichiers de flag
    """
    logger.info(f"🛑 Received cancel-all request for type: {job_type}")
    logger.info(f"🛑 Active jobs before cancel: {list(active_jobs.keys())}")

    # Utiliser le système de fichiers de flag
    cancelled_count = cancel_all_jobs_of_type(job_type)

    logger.info(f"🛑 Cancelled {cancelled_count} job(s) via flag files")

    return {"success": True, "cancelled_count": cancelled_count, "method": "flag_file"}


@app.get("/jobs")
async def list_active_jobs():
    """
    Liste les jobs actifs
    """
    return {
        "active_jobs": list(active_jobs.keys()),
        "count": len(active_jobs)
    }


@app.post("/upscale")
async def upscale_image(request: UpscaleRequest):
    """
    Upscale une image avec Real-ESRGAN (general ou anime)
    Retourne directement le résultat (comme /generate)
    """
    # Mettre à jour le timestamp d'utilisation
    update_last_usage()

    # Créer un job ID pour cet upscaling
    job_id = create_job_id()
    active_jobs[job_id] = {"cancelled": False, "type": "upscale"}

    try:
        logger.info(f"🔍 Upscaling image (job {job_id}) with Real-ESRGAN {request.model}")

        # Décoder l'image
        input_image = base64_to_image(request.image)

        # Convertir en RGB si nécessaire
        if input_image.mode != 'RGB':
            logger.info(f"Converting image from {input_image.mode} to RGB")
            input_image = input_image.convert('RGB')

        # Upscale avec Real-ESRGAN (modèle sélectionné: general ou anime)
        logger.info(f"Loading ESRGAN {request.model} model...")
        esrgan = load_esrgan(request.model)
        if esrgan is None:
            raise HTTPException(status_code=503, detail=f"Real-ESRGAN ({request.model}) not available")

        logger.info(f"Starting ESRGAN upscale (x{request.scale})...")
        import numpy as np

        img_np = np.array(input_image)
        logger.info(f"Input image shape: {img_np.shape}, dtype: {img_np.dtype}")

        # Vérifier si annulé avant de commencer
        if is_job_cancelled(job_id):
            logger.info(f"Job {job_id} cancelled before ESRGAN processing")
            raise HTTPException(status_code=499, detail=f"Job {job_id} was cancelled")

        # Le traitement ESRGAN est bloquant, on doit l'exécuter dans un executor
        loop = asyncio.get_event_loop()
        output_np, _ = await loop.run_in_executor(
            None,
            lambda: esrgan.enhance(img_np, outscale=request.scale)
        )
        logger.info(f"ESRGAN upscale completed, output shape: {output_np.shape}")

        # S'assurer que l'output est en uint8 pour une qualité optimale
        if output_np.dtype != np.uint8:
            output_np = np.clip(output_np, 0, 255).astype(np.uint8)

        output_image = Image.fromarray(output_np, mode='RGB')

        # Convertir en base64 avec haute qualité pour préserver les détails
        output_base64 = image_to_base64(output_image, high_quality=True)

        logger.info(f"✅ Image upscaled successfully (high quality PNG)")

        # Nettoyer le job de la liste active
        if job_id in active_jobs:
            del active_jobs[job_id]

        return {
            "success": True,
            "image": output_base64,
            "job_id": job_id,
            "info": {
                "method": f"esrgan-x4plus-{request.model}",
                "model": request.model,
                "scale": request.scale,
                "original_size": f"{input_image.width}x{input_image.height}",
                "output_size": f"{output_image.width}x{output_image.height}"
            }
        }

    except HTTPException:
        if job_id in active_jobs:
            del active_jobs[job_id]
        raise
    except Exception as e:
        logger.error(f"❌ Error upscaling image: {e}")
        if job_id in active_jobs:
            del active_jobs[job_id]
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/unload")
async def unload_models():
    """
    Décharge les modèles de la mémoire (libère la VRAM)
    """
    global txt2img_pipeline, img2img_pipeline, esrgan_models

    if txt2img_pipeline is not None:
        del txt2img_pipeline
        txt2img_pipeline = None

    if img2img_pipeline is not None:
        del img2img_pipeline
        img2img_pipeline = None

    if esrgan_models:
        esrgan_models.clear()

    if device == "cuda":
        torch.cuda.empty_cache()

    logger.info("🗑️ Models unloaded, VRAM freed")

    return {"success": True, "message": "Models unloaded"}


# ==================== STARTUP ====================

if __name__ == "__main__":
    import uvicorn

    # Nettoyer les anciens fichiers de flag au démarrage
    cleanup_cancel_flags()

    # Pré-charger le pipeline txt2img au démarrage (le plus utilisé)
    logger.info("🚀 Pre-loading txt2img pipeline...")
    load_txt2img_pipeline()

    # Démarrer le serveur
    uvicorn.run(app, host="0.0.0.0", port=8000)
