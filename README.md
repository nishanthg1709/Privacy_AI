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

## Privacy & Security Guarantees

- **100% Local Inference**: Zero data is transmitted to third-party AI APIs. Neural inference is executed locally using GLiNER.
- **Zero-Log Policy**: Raw documents, prompts, and sensitive entity values are never stored or logged.
- **Dual-Pass Verification**: Protected outputs undergo a secondary detection pass to audit and report residual re-identification risks.
