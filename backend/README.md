# PrivacyGuard AI Backend

A local, AI-powered privacy minimization engine built with **FastAPI**, **GLiNER** (Generalist Lightweight Information Extraction), and **Microsoft Presidio**.

The engine contextually identifies sensitive PII (names, contact details, financial numbers, government IDs, developer secrets, and health information), applies intelligent task-aware redaction, and runs a secondary verification audit to detect residual risks.

---

## 🌟 Key Features

- **Local Neural Inference**: Uses `urchade/gliner_small-v2.1` (bidirectional transformer, Apache-2.0 license) running 100% locally on CPU/Apple Silicon. No prompt text or document content is ever sent to external cloud AI APIs.
- **Complementary Verification Framework**: Microsoft Presidio adds checksum algorithms (Luhn for credit cards, phone parsing via Google `phonenumbers`, RFC-compliant email detection) alongside deterministic secret pattern scanners.
- **Dual-Pass Verification**: The engine verifies its own protected output with a second automated detection pass to flag residual risks.
- **Consistent Referential Placeholders**: Repeated entities receive identical tags across the document (e.g. `[PERSON_1]`, `[EMAIL_1]`).
- **Flexible Privacy Modes**:
  - `strict` (or `redaction`): Blackout redaction of all detected sensitive entities.
  - `task-aware`: Applies explicit, documented minimization rules and flags ambiguous contextual decisions for human audit.
  - `user-approved`: Returns proposed candidate redactions without claiming approval or altering source text irreversibly.
  - `synthetic`: Replaces sensitive tokens with realistic synthetic demo data.
  - `tokenized`: Replaces sensitive entities with numbered semantic tokens.
- **Zero-Log Architecture**: Original prompt documents, detected values, and sensitive spans are never logged to console, disk, or databases.
- **Honest Degraded-State Reporting**: Never silently substitutes regex if the AI model fails to load. Operational status (`ready`, `degraded`, `error`) is exposed transparently.

---

## 🏗️ Architecture & Model Details

| Component | Technology | Purpose | Licensing & Footprint |
| :--- | :--- | :--- | :--- |
| **API Framework** | FastAPI + Uvicorn | High-performance asynchronous REST API | MIT License |
| **Contextual AI** | GLiNER Small v2.1 | Pretrained neural entity extractor in context | Apache 2.0 (~160MB weights, ~400MB RAM) |
| **Rule & Checksum** | Microsoft Presidio | Rule recognition, Luhn checksums, phonenumbers | MIT License |
| **Verification** | Dual-pass auditor | Secondary detection pass to catch leaks & edge cases | In-memory engine |
| **Validation** | Pydantic v2 | Strict schema contracts and payload size limits | MIT License |

### Supported Categories
- **Contact PII**: Names (`PERSON`), Email Addresses (`EMAIL_ADDRESS`), Phone Numbers (`PHONE_NUMBER`), Street Addresses / Locations (`LOCATION`)
- **Government Identifiers**: US Social Security Numbers (`SSN`), Passports (`PASSPORT`), Driver Licenses (`DRIVER_LICENSE`)
- **Financial Data**: Credit Card Numbers (`CREDIT_CARD`), Bank Account Numbers (`BANK_ACCOUNT`), IBAN Codes (`IBAN`), Crypto Wallets (`CRYPTO_WALLET`)
- **Developer Credentials**: AWS Access Keys (`AWS_ACCESS_KEY`), API Keys (`API_KEY`), GitHub/GitLab Tokens, Passwords, Service Secrets
- **Protected Health Information (PHI)**: Medical Conditions (`MEDICAL_CONDITION`), Medical Record Numbers (`MRN`), Health Insurance IDs

---

## 🚀 Beginner's Quickstart Guide (macOS)

### 1. Prerequisites
- macOS (Apple Silicon M1/M2/M3/M4 or Intel)
- Python 3.10+ installed (`python3 --version`)
- Terminal (open via Spotlight: `Cmd + Space` -> type `Terminal`)

### 2. Navigate to Backend Directory
```bash
cd /Users/nishu/Projects/Prg_AI/backend
```

### 3. Create & Activate Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
```
*(When active, your terminal prompt will show `(venv)`).*

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Setup Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Default configuration settings in `.env`:
```ini
HOST=127.0.0.1
PORT=8000
CORS_ORIGINS=http://localhost:5173
AI_MODEL_NAME=urchade/gliner_small-v2.1
AI_DEVICE=cpu
AI_CONFIDENCE_THRESHOLD=0.40
ENABLE_PRESIDIO=true
MAX_PAYLOAD_CHARS=100000
```

### 6. Start the Backend Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
You should see:
```text
INFO: Application startup complete.
INFO: Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

---

## 🧪 Testing Every Endpoint Using `/docs`

FastAPI includes an interactive **Swagger UI**. Open your browser to:
👉 **[http://localhost:8000/docs](http://localhost:8000/docs)**

### 1. Test `GET /health` (Server Liveness)
1. Click on **`GET /health`** or **`GET /api/health`**.
2. Click **"Try it out"**, then **"Execute"**.
3. **Expected Response (HTTP 200)**:
   ```json
   {
     "status": "ok",
     "service": "PrivacyGuard AI Backend",
     "version": "1.0.0",
     "engine_ready": true
   }
   ```

### 2. Test `GET /api/engine-status` (Model Health & Categories)
1. Click on **`GET /api/engine-status`**.
2. Click **"Try it out"**, then **"Execute"**.
3. **Expected Response (HTTP 200)**:
   ```json
   {
     "status": "ready",
     "model_name": "urchade/gliner_small-v2.1",
     "model_loaded": true,
     "device": "cpu",
     "inference_backend": "gliner_pytorch",
     "presidio_enabled": true,
     "supported_categories": [
       "Contact PII",
       "Developer Credentials",
       "Financial Data",
       "General PII",
       "Government ID",
       "Location Data",
       "Network Identifier",
       "Organization Data",
       "Protected Health Information (PHI)"
     ],
     "error_message": null
   }
   ```

### 3. Test `POST /api/scan` (Privacy Minimization Scan)
1. Click on **`POST /api/scan`**.
2. Click **"Try it out"**.
3. In the **Request body** text box, paste one of the examples below.
4. Click **"Execute"**.

#### Example A: Strict Mode Redaction
**Request Body**:
```json
{
  "text": "Hello Support, my name is Sarah Connor (SSN: 482-19-9481). Email me at sarah.connor@cyberdyne.org or call 555-234-5678. My API key is sk-live9876543210abcdef9876543210.",
  "task": "Customer Support Prompt Audit",
  "privacy_mode": "strict",
  "strictness": "gdpr-hipaa"
}
```
**Sample Response Highlights**:
- `protected_text`: `"Hello Support, my name is [PERSON_1] (SSN: [SSN_1]). Email me at [EMAIL_ADDRESS_1] or call [PHONE_NUMBER_1]. My API key is [SECRET_KEY_1]."`
- `findings`: Array with exact character offsets (`start`, `end`), `confidence` (e.g. 0.95), `source` (`gliner_ai`, `presidio`, `deterministic_rule`), and `risk`.
- `verification`: Secondary scan results auditing residual risks.

#### Example B: Task-Aware Mode (Contextual Audit)
**Request Body**:
```json
{
  "text": "Customer Sarah Connor submitted ticket #402. Email is sarah@example.com. Server key is AKIAIOSFODNN7EXAMPLE.",
  "task": "Customer Support Ticket Routing",
  "privacy_mode": "task-aware"
}
```
*Notice: High-risk developer secrets are redacted unconditionally, while customer contact items are flagged with `is_ambiguous: true` explaining contextual relevance.*

#### Example C: User-Approved Review Mode
**Request Body**:
```json
{
  "text": "Please share quarterly summary with Dr. Robert Miller at r.miller@hospital.org.",
  "task": "Executive Summary Audit",
  "privacy_mode": "user-approved"
}
```
*Notice: Entities receive action `"Proposed Redaction"` and the output text flags candidates without destructive changes.*

---

## 🔬 Automated Testing

Run the automated test suite with pytest:
```bash
# Run all tests
PYTHONPATH=. pytest -v

# Run only live model inference tests
PYTHONPATH=. pytest -v -m real_inference
```

**Test Coverage Summary**:
- `TestUnitSpanReconciliation`: Overlapping spans (e.g. email encompassing name), precedence of secret rules, invalid offset safety.
- `TestUnitPrivacyModesAndPlaceholders`: Sequential placeholder indexing (`[PERSON_1]`, `[PERSON_2]`), repeated entity consistency, user-approved proposed mode, task-aware ambiguity flags.
- `TestUnitModelLoadingFailuresAndDegradedState`: Simulated model loading crashes, verifying transparent degraded status without silent substitution.
- `TestUnitValidationAndPayloadLimits`: Blank text rejection (422), invalid privacy mode (422), oversized payload enforcement.
- `TestLiveModelInference`: Real local GLiNER and Presidio neural inference, real confidence scores, real character offsets.
- `TestApiEndpoints`: `/health`, `/api/health`, `/api/engine-status`, and CORS restrictions.

---

## 🔒 Security & Privacy Practices

1. **Zero External AI Calls**: No data is sent to external API endpoints. All models run in local system memory.
2. **Zero-Log Policy**: Raw texts and detected sensitive values are never logged. Only scan IDs, finding counts, and timing metrics are logged.
3. **Deterministic Memory Cleanup**: Transformed texts and findings reside in transient request memory.
4. **CORS Boundary**: Cross-Origin Resource Sharing is strictly constrained to `http://localhost:5173`.
5. **Human-in-the-Loop Recommendation**: Automated AI redaction significantly reduces exposure, but probabilistic models cannot guarantee mathematical 100% perfection. High-consequence or regulated documents should pair automated scans with human review.
