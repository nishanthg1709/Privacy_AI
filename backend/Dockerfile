# ==============================================================================
# PrivacyGuard AI - Production Dockerfile for Hugging Face Spaces / Container
# Hardware Target: 2 vCPU | 16 GB RAM (Free Tier)
# Port: 7860 (Hugging Face default) | Non-root UID: 1000
# ==============================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    HOME=/home/user

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
    pip install --no-cache-dir -r requirements.txt

# Pre-download GLiNER model weights during image build
# This bakes the ~165 MB model into the image so container startup is instantaneous (< 3s)
RUN python -c "from gliner import GLiNER; GLiNER.from_pretrained('urchade/gliner_small-v2.1')"

# Copy backend application source code
COPY --chown=user:user . .

# Switch to non-root user
USER user

# Expose default ports (8000 for standard/Render, 7860 for Hugging Face)
EXPOSE 8000 7860

# Health check endpoint dynamically using $PORT
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Launch Uvicorn dynamically bound to $PORT with 1 worker to prevent memory duplication
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
