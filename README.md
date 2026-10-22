# PrivacyGuard AI

PrivacyGuard AI is a local-first, AI-powered privacy minimization engine that detects sensitive personal data (PII), credentials, and regulated information in prompt documents, minimizes unnecessary exposure, and verifies the protected output with automated secondary auditing.

## Project Structure

```text
Prg_AI/
├── frontend/     # Modern React + Vite application (Privacy scanner, dashboard, audit UI)
├── backend/      # FastAPI local AI backend (GLiNER + Microsoft Presidio)
└── README.md     # Project overview
```

## Quick Start

### 1. Start the Backend (Port 8000)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API documentation available at: `http://localhost:8000/docs`

### 2. Start the Frontend (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

## Deployment Architecture & Hosting

PrivacyGuard AI is architected for dual-mode deployment:
- **High-Capacity Mode (>= 2 GB RAM)**: Enables resident neural GLiNER (`urchade/gliner_small-v2.1`) combined with Microsoft Presidio for contextual deep-learning PII extraction.
- **Resource-Constrained Free Tier (Render Free 512 MB RAM)**: Runs in explicit, honest degraded mode (`ENABLE_GLINER=false`) using Microsoft Presidio and spaCy `en_core_web_sm` with custom deterministic recognizers, line-boundary chunking, and memory guards to operate safely within a 512 MB memory footprint.

### Hosting Endpoints
- **Frontend (Vercel)**: `https://privacy-ai-kappa.vercel.app`
- **Backend (Render Free)**: `https://privacy-ai-hliq.onrender.com`
- **Health Check**: `GET /api/health`
- **Engine Status**: `GET /api/engine-status`

---

## Environment Variables

### Backend Configuration (Render Dashboard -> Environment)

| Variable | Recommended (Render Free) | Purpose |
| :--- | :--- | :--- |
| `ENABLE_GLINER` | `false` | Disables PyTorch/GLiNER neural weights to fit within 512 MB RAM cap. |
| `ENABLE_PRESIDIO` | `true` | Enables Microsoft Presidio analyzer and anonymizer framework. |
| `PRESIDIO_DEVICE` | `cpu` | Enforces CPU execution and prevents speculative PyTorch initialization. |
| `SPACY_MODEL` | `en_core_web_sm` | Lightweight spaCy language model for NER, tokens, and lemmas. |
| `CORS_ORIGINS` | `https://privacy-ai-kappa.vercel.app,http://localhost:5173` | Allowed cross-origin client domains. |
| `MAX_PAYLOAD_CHARS` | `100000` | Maximum raw document text size per scan request (100k chars). |
| `PORT` | `8000` | Default container binding port. |

### Frontend Configuration (Vercel Dashboard -> Project Settings -> Environment Variables)

| Variable | Recommended | Purpose |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://privacy-ai-hliq.onrender.com` | Base URL of deployed FastAPI backend. |
| `VITE_SCAN_TIMEOUT_MS` | `60000` | Client scan request timeout in ms (default: 60s, accounts for Render cold starts). |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Supabase project URL for authentication & metadata audit log. |
| `VITE_SUPABASE_ANON_KEY`| `<supabase-public-anon-key>` | Public anon key (restricted via Supabase Row-Level Security). |

---

## Free-Tier Operational Constraints & Troubleshooting

### 1. Render Free Cold Starts (~50 Seconds)
Render Free instances spin down after 15 minutes of inactivity. The first scan or health check after sleep may take ~50 seconds while the container initializes. The frontend is configured with a 60-second timeout (`VITE_SCAN_TIMEOUT_MS=60000`) and displays non-blocking loading states during cold starts.

### 2. Honest Degraded Mode
When `ENABLE_GLINER=false`:
- The backend reports `model_loaded: false`, `inference_backend: "presidio_hybrid"`, and `status: "degraded"`.
- Entity recognition covers Contact PII, Financial Data, Government IDs, Healthcare Identifiers, Location Data, and Developer Secrets via Microsoft Presidio and rule recognizers.
- Contextual deep-neural inference is skipped. System alerts and disclaimers transparently inform users of this mode without fabricating AI models.

### 3. Memory Safeguards (512 MB RAM Target)
- **Scoped Neural Blocker**: Prevents speculative PyTorch/Transformers imports during Presidio startup.
- **Line-Boundary Chunking**: Large multi-line documents and CSVs (>4,000 chars) are chunked on line boundaries to keep spaCy token tensor buffers under 185 MB peak RSS.
- **Single Uvicorn Worker**: Limits process duplication (`--workers 1`).
- **Sequential Scan Lock**: Concurrency guard ensures multiple simultaneous scans do not spike memory.
- **Idempotency Cache**: Bounded in-memory LRU cache returns identical results for repeated `request_id` values, preventing redundant NLP allocations and duplicate database history rows.

---

## Privacy & Security Guarantees

- **Zero Third-Party Model APIs**: Zero data is transmitted to OpenAI, Anthropic, or external inference APIs.
- **Zero-Log Persistence**: Raw documents, prompts, and sensitive entity values are never stored in databases or server logs. Only anonymized operational telemetry (finding counts, categories, privacy score) is persisted via Supabase RLS.
- **Dual-Pass Verification**: Protected outputs undergo an automated secondary detection pass to audit and report residual re-identification risks.

