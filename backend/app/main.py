"""PrivacyGuard AI Backend Service.

FastAPI application providing:
- GET /health and GET /api/health: Health check endpoints
- GET /api/engine-status: Live operational readiness and model status
- POST /api/scan: Contextual PII detection, task-aware protection, and verification
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv

from app.schemas import (
    ScanRequest,
    ScanResponse,
    HealthResponse,
    EngineStatus,
)
from app.services.ai_detector import detector_service
from app.services.privacy_engine import privacy_engine

# Load environment configuration from .env if present
load_dotenv()

# Configure structured logging with zero-leak policy
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("privacy_guard.main")

CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [orig.strip() for orig in CORS_ORIGINS_RAW.split(",") if orig.strip()]
AI_MODEL_NAME = os.getenv("AI_MODEL_NAME", "urchade/gliner_small-v2.1")
AI_DEVICE = os.getenv("AI_DEVICE", "cpu")
AI_CONFIDENCE_THRESHOLD = float(os.getenv("AI_CONFIDENCE_THRESHOLD", "0.40"))
ENABLE_PRESIDIO = os.getenv("ENABLE_PRESIDIO", "true").lower() in ("true", "1", "yes")
MAX_PAYLOAD_CHARS = int(os.getenv("MAX_PAYLOAD_CHARS", "100000"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager to initialize models once on startup."""
    logger.info("Initializing PrivacyGuard AI backend services...")
    try:
        # Load real pretrained model and complementary engines once during startup
        detector_service.load_engines(
            model_name=AI_MODEL_NAME,
            device=AI_DEVICE,
            confidence_threshold=AI_CONFIDENCE_THRESHOLD,
            enable_presidio=ENABLE_PRESIDIO,
        )
        logger.info(
            "Engine initialization complete: model_loaded=%s, presidio_loaded=%s, status=%s",
            detector_service.model_loaded,
            detector_service.presidio_loaded,
            detector_service.status,
        )
    except Exception as e:
        logger.critical("Fatal error during engine startup: %s", str(e), exc_info=True)
        detector_service.status = "error"
        detector_service.load_error = str(e)
    yield
    logger.info("Shutting down PrivacyGuard AI backend services.")


app = FastAPI(
    title="PrivacyGuard AI Engine",
    description="Local AI-powered contextual PII detection and minimization engine.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS restricted to frontend application origins, Vercel deployments, and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$|^https://.*\.hf\.space$|^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return clean, informative error messages for invalid client requests."""
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid parameter")
        errors.append(f"{field}: {msg}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation Error",
            "detail": "; ".join(errors),
            "status_code": 422,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Uniform handler for HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "Request Error",
            "detail": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler ensuring no internal traceback or sensitive data leaks."""
    logger.error("Unhandled server exception: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": "An internal error occurred while processing the privacy scan.",
            "status_code": 500,
        },
    )


@app.get("/", tags=["System"])
async def root_endpoint() -> Dict[str, Any]:
    """Root metadata endpoint."""
    return {
        "service": "PrivacyGuard AI Backend",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "engine_status": "/api/engine-status",
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Return backend server and engine health status."""
    return HealthResponse(
        status="ok",
        service="PrivacyGuard AI Backend",
        version="1.0.0",
        engine_ready=(detector_service.status in ("ready", "degraded")),
    )


@app.get("/api/engine-status", response_model=EngineStatus, tags=["Engine"])
async def get_engine_status() -> EngineStatus:
    """Return detailed status of the local AI model and complementary recognizers.

    Exposes true operational state: ready, degraded, or error.
    """
    return EngineStatus(
        status=detector_service.status,
        model_name=detector_service.model_name,
        model_loaded=detector_service.model_loaded,
        device=detector_service.device,
        inference_backend="gliner_pytorch" if detector_service.model_loaded else "presidio_hybrid",
        presidio_enabled=detector_service.presidio_loaded,
        supported_categories=detector_service.get_supported_categories(),
        error_message=detector_service.load_error,
    )


@app.post("/api/scan", response_model=ScanResponse, tags=["Scanner"])
async def scan_payload(payload: ScanRequest) -> ScanResponse:
    """Scan document text, detect sensitive context, redact according to mode, and verify.

    Accepts:
    - text: raw document or prompt content (max 100,000 characters)
    - task: task description / context label
    - privacy_mode: 'strict', 'task-aware', 'user-approved', 'synthetic', 'tokenized', 'redaction'
    - strictness: 'gdpr-hipaa', 'standard', 'secrets-only'

    Returns:
    - scan_id, protected_text, findings, summary, privacy_mode, engine_status, verification
    """
    # Enforce payload size limit
    if len(payload.text) > MAX_PAYLOAD_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Payload exceeds maximum allowed size of {MAX_PAYLOAD_CHARS} characters.",
        )

    try:
        response = privacy_engine.process_scan(
            text=payload.text,
            task=payload.task or "Prompt Privacy Audit",
            privacy_mode=payload.privacy_mode or "strict",
            strictness=payload.strictness or "gdpr-hipaa",
        )
        return response
    except Exception as e:
        logger.error("Scan processing failure: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete privacy scan.",
        )


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "7860"))
    logger.info("Starting PrivacyGuard AI on %s:%d", host, port)
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
