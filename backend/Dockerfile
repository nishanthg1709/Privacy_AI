# ==============================================================================
# PrivacyGuard AI - Production Dockerfile for Render Free (512 MB RAM)
# Hardware Target: Render Free | 512 MB RAM | 1 vCPU
# Port: 8000 | Non-root UID: 1000
#
# Memory Budget (ENABLE_GLINER=false):
#   Python baseline:           ~16 MB
#   Presidio + spaCy sm:      ~158 MB
#   Peak during 20 KB scan:   ~180 MB
#   Headroom under 512 MB cap: ~330 MB
#
# The LowMemoryImportBlocker in ai_detector.py prevents spaCy/thinc from
# loading torch at startup, saving ~300 MB. GLiNER is NOT pre-downloaded here
# to keep the image lean and avoid OOM during Docker build.
# ==============================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
# Thread limits prevent NumPy/BLAS from spinning extra threads that waste RAM
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    HOME=/home/user \
    SPACY_MODEL=en_core_web_sm \
    PRESIDIO_DEVICE=cpu \
    ENABLE_GLINER=false \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    TOKENIZERS_PARALLELISM=false

# Install system dependencies (build tools, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user with UID 1000
RUN useradd -m -u 1000 user
WORKDIR $HOME/app

# Install Python dependencies first for optimal Docker layer caching
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    python -m spacy download en_core_web_sm && \
    python -c "import spacy; spacy.load('en_core_web_sm'); print('spaCy en_core_web_sm verified.')"

# NOTE: GLiNER model weights are NOT pre-downloaded here.
# When ENABLE_GLINER=false (Render Free), GLiNER is never loaded at runtime.
# Pre-downloading would add ~1.5 GB to the image and risk OOM during Docker build.
# To enable GLiNER on higher-memory platforms, set ENABLE_GLINER=true at runtime
# and the model will download on first startup.

# Copy backend application source code
COPY --chown=user:user . .

# Switch to non-root user
USER user

# Expose default port
EXPOSE 8000

# Health check: /api/health is the correct canonical path
# start-period=90s allows time for Presidio+spaCy initialization on cold boot
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Launch Uvicorn with 1 worker (critical: prevents RAM duplication from forking)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
