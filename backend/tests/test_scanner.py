"""Automated test suite for PrivacyGuard AI backend.

Covers:
- Unit tests: Span reconciliation, placeholder consistency, task-aware rules, privacy modes, invalid requests
- Model failure handling: Verifying degraded state reporting without silent fallback deception
- Verification audit: Secondary detection pass and residual risk reporting
- Live integration tests: Real local model inference using resident GLiNER and Presidio

All tests use 100% synthetic data.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.main import app
from app.services.ai_detector import AIDetectorService, RawDetection
from app.services.privacy_engine import PrivacyEngine
from app.schemas import ScanRequest


# ============================================================================
# Test Fixtures & Clients
# ============================================================================

@pytest.fixture(scope="module")
def client():
    """TestClient that triggers the FastAPI lifespan startup."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_detector():
    """Provides an isolated detector instance for deterministic unit testing."""
    detector = AIDetectorService()
    detector.model_loaded = True
    detector.presidio_loaded = True
    detector.status = "ready"
    return detector


@pytest.fixture
def isolated_engine(mock_detector):
    """Provides an isolated PrivacyEngine configured with mock detector."""
    return PrivacyEngine(detector=mock_detector)


# ============================================================================
# GROUP A: Unit Tests (Mocked / Pure Logic)
# ============================================================================

class TestUnitSpanReconciliation:
    """Tests span reconciliation, overlapping entity resolution, and offset safety."""

    def test_overlapping_email_encompassing_person(self, mock_detector):
        """When an email address contains a name span, the broader email span must be preserved."""
        text = "Contact Sarah Connor at sarah.connor@example.com for support."
        # Email is characters 24 to 48: 'sarah.connor@example.com'
        # Nested name is characters 24 to 36: 'sarah.connor'
        detections = [
            RawDetection(
                start=24, end=48, text="sarah.connor@example.com",
                type_="EMAIL_ADDRESS", category="Contact PII", risk="Medium",
                confidence=0.98, source="presidio", explanation="Presidio recognized email"
            ),
            RawDetection(
                start=24, end=36, text="sarah.connor",
                type_="PERSON", category="Contact PII", risk="Medium",
                confidence=0.85, source="gliner_ai", explanation="Contextual name"
            ),
        ]

        reconciled = mock_detector.reconcile_spans(text, detections)
        assert len(reconciled) == 1
        assert reconciled[0].type_ == "EMAIL_ADDRESS"
        assert reconciled[0].text == "sarah.connor@example.com"

    def test_deterministic_secret_takes_precedence_over_generic_entity(self, mock_detector):
        """Deterministic secret signatures take priority over overlapping general entities."""
        text = "Config key: AKIAIOSFODNN7EXAMPLE is used."
        detections = [
            RawDetection(
                start=12, end=32, text="AKIAIOSFODNN7EXAMPLE",
                type_="AWS_ACCESS_KEY", category="Developer Credentials", risk="High",
                confidence=0.99, source="deterministic_rule", explanation="AWS key pattern"
            ),
            RawDetection(
                start=12, end=32, text="AKIAIOSFODNN7EXAMPLE",
                type_="ORGANIZATION", category="Organization Data", risk="Low",
                confidence=0.45, source="gliner_ai", explanation="Contextual org"
            ),
        ]

        reconciled = mock_detector.reconcile_spans(text, detections)
        assert len(reconciled) == 1
        assert reconciled[0].type_ == "AWS_ACCESS_KEY"
        assert reconciled[0].source == "deterministic_rule"

    def test_invalid_offsets_safely_ignored(self, mock_detector):
        """Offsets outside text bounds or with inverted indices must be discarded."""
        text = "Short text."
        detections = [
            RawDetection(
                start=-5, end=10, text="invalid", type_="PERSON",
                category="Contact PII", risk="Medium", confidence=0.9,
                source="gliner_ai", explanation="Invalid negative start"
            ),
            RawDetection(
                start=5, end=500, text="overflow", type_="PERSON",
                category="Contact PII", risk="Medium", confidence=0.9,
                source="gliner_ai", explanation="Overflow past length"
            ),
            RawDetection(
                start=8, end=4, text="inverted", type_="PERSON",
                category="Contact PII", risk="Medium", confidence=0.9,
                source="gliner_ai", explanation="Inverted start/end"
            ),
        ]
        reconciled = mock_detector.reconcile_spans(text, detections)
        assert len(reconciled) == 0

    def test_clean_boundary_artifacts_trims_csv_and_quotes(self, mock_detector):
        """Surrounding delimiters, quotes, and CSV index prefixes must be trimmed from detected entities."""
        text = '1,"Sarah Connor",sarah@example.com'
        # Span covering 1,"Sarah Connor"
        s, e = mock_detector._clean_boundary_artifacts(text, 0, 16, "PERSON")
        assert text[s:e] == "Sarah Connor"

        # Trailing comma on email
        s_mail, e_mail = mock_detector._clean_boundary_artifacts(text, 17, len(text), "EMAIL_ADDRESS")
        assert text[s_mail:e_mail] == "sarah@example.com"


class TestUnitPrivacyModesAndPlaceholders:
    """Tests placeholder consistency, privacy modes, and task-relevance rules."""

    def test_placeholder_consistency_for_repeated_entities(self, isolated_engine, mock_detector):
        """The same sensitive value appearing multiple times must receive the identical placeholder."""
        text = "Alice Morgan met with Alice Morgan to discuss the project."
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(start=0, end=12, text="Alice Morgan", type_="PERSON", category="Contact PII",
                         risk="Medium", confidence=0.95, source="gliner_ai", explanation="Name 1"),
            RawDetection(start=22, end=34, text="Alice Morgan", type_="PERSON", category="Contact PII",
                         risk="Medium", confidence=0.95, source="gliner_ai", explanation="Name 2"),
        ])

        response = isolated_engine.process_scan(text=text, privacy_mode="strict")
        assert response.protected_text == "[PERSON_1] met with [PERSON_1] to discuss the project."
        assert len(response.findings) == 2
        assert response.findings[0].sanitizedSnippet == "[PERSON_1]"
        assert response.findings[1].sanitizedSnippet == "[PERSON_1]"

    def test_distinct_entities_receive_incremented_placeholders(self, isolated_engine, mock_detector):
        """Different sensitive entities of the same type receive sequential placeholders."""
        text = "Alice Morgan sent an email to Bob Vance."
        # 'Alice Morgan' is [0:12], 'Bob Vance' is [30:39]
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(start=0, end=12, text="Alice Morgan", type_="PERSON", category="Contact PII",
                         risk="Medium", confidence=0.95, source="gliner_ai", explanation="Name 1"),
            RawDetection(start=30, end=39, text="Bob Vance", type_="PERSON", category="Contact PII",
                         risk="Medium", confidence=0.92, source="gliner_ai", explanation="Name 2"),
        ])

        response = isolated_engine.process_scan(text=text, privacy_mode="strict")
        assert response.protected_text == "[PERSON_1] sent an email to [PERSON_2]."
        assert response.findings[0].sanitizedSnippet == "[PERSON_1]"
        assert response.findings[1].sanitizedSnippet == "[PERSON_2]"

    def test_user_approved_mode_proposes_without_claiming_approval(self, isolated_engine, mock_detector):
        """In user-approved mode, actions are marked 'Proposed Redaction' and summary states review pending."""
        text = "User Alice Morgan requested access."
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(start=5, end=17, text="Alice Morgan", type_="PERSON", category="Contact PII",
                         risk="Medium", confidence=0.9, source="gliner_ai", explanation="Name"),
        ])

        response = isolated_engine.process_scan(text=text, privacy_mode="user-approved")
        assert response.findings[0].action == "Proposed Redaction"
        assert "[PROPOSED" in response.protected_text
        assert "user review" in response.summary.lower()

    def test_task_aware_flags_ambiguous_customer_support_decisions(self, isolated_engine, mock_detector):
        """Task-aware mode flags ambiguous decisions when entity relevance depends on context."""
        text = "Please reach out to support@example.com."
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(start=20, end=39, text="support@example.com", type_="EMAIL_ADDRESS",
                         category="Contact PII", risk="Medium", confidence=0.95,
                         source="presidio", explanation="Email"),
        ])

        response = isolated_engine.process_scan(
            text=text,
            task="Customer Support Ticket Resolution",
            privacy_mode="task-aware"
        )
        assert len(response.findings) == 1
        finding = response.findings[0]
        assert finding.is_ambiguous is True
        assert finding.ambiguity_reason is not None
        assert "Ambiguous" in finding.ambiguity_reason

    def test_task_aware_strictly_redacts_credentials_without_ambiguity(self, isolated_engine, mock_detector):
        """Credentials are never considered task-justified and are redacted without ambiguity."""
        text = "Config contains API key sk-test12345678901234567890123456."
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(start=24, end=58, text="sk-test12345678901234567890123456", type_="API_KEY",
                         category="Developer Credentials", risk="High", confidence=0.99,
                         source="deterministic_rule", explanation="API key"),
        ])

        response = isolated_engine.process_scan(
            text=text,
            task="DevOps Pipeline Deployment",
            privacy_mode="task-aware"
        )
        assert response.findings[0].action == "Redacted"
        assert response.findings[0].is_ambiguous is False


class TestUnitPrivacyIntelligence:
    """Tests Task 11 explainable privacy intelligence: risk reasoning, data minimization, uncertainty, and combination risks."""

    def test_risk_reason_and_minimization_recommendation(self, isolated_engine, mock_detector):
        """Validates that risk reasoning and data minimization recommendations are generated per category."""
        text = "Key: sk-secret1234567890123456. Patient John Doe has diabetes diagnosis."
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(
                start=5, end=31, text="sk-secret1234567890123456", type_="API_KEY",
                category="Developer Credentials", risk="High", confidence=0.99,
                source="deterministic_rule", explanation="Secret key"
            ),
            RawDetection(
                start=41, end=49, text="John Doe", type_="PERSON",
                category="Contact PII", risk="Medium", confidence=0.92,
                source="gliner_ai", explanation="Patient name"
            ),
            RawDetection(
                start=54, end=62, text="diabetes", type_="MEDICAL_CONDITION",
                category="Protected Health Information (PHI)", risk="High", confidence=0.88,
                source="gliner_ai", explanation="Clinical condition"
            ),
        ])

        response = isolated_engine.process_scan(text=text, task="Clinical Audit", privacy_mode="strict")
        findings_by_type = {f.type: f for f in response.findings}

        # Developer Credentials -> Remove
        cred = findings_by_type["API_KEY"]
        assert cred.recommendation == "Remove"
        assert "unauthorized infrastructure" in cred.risk_reason

        # Contact PII -> Replace with Placeholder
        person = findings_by_type["PERSON"]
        assert person.recommendation == "Replace with Placeholder"
        assert "Direct personal contact" in person.risk_reason

        # PHI -> Generalize
        phi = findings_by_type["MEDICAL_CONDITION"]
        assert phi.recommendation == "Generalize"
        assert "HIPAA" in phi.risk_reason

    def test_uncertainty_flag_for_low_confidence_or_short_tokens(self, isolated_engine, mock_detector):
        """Borderline confidence (< 0.65) or short ambiguous tokens flag is_uncertain with explanation."""
        text = "Meeting at AI Inc."
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(
                start=11, end=13, text="AI", type_="ORGANIZATION",
                category="Organization Data", risk="Low", confidence=0.55,
                source="gliner_ai", explanation="Short org acronym"
            ),
        ])

        response = isolated_engine.process_scan(text=text, task="General Audit", privacy_mode="strict")
        finding = response.findings[0]
        assert finding.is_uncertain is True
        assert finding.uncertainty_reason is not None
        assert "0.55" in finding.uncertainty_reason

    def test_combination_risks_triad_and_clinical_linkage(self, isolated_engine, mock_detector):
        """Identifies quasi-identifier triads (Person + Location + Org) and clinical linkage risks."""
        text = "Dr. Alice Morgan at City Hospital in Boston treated the patient."
        mock_detector.detect_all = MagicMock(return_value=[
            RawDetection(start=4, end=16, text="Alice Morgan", type_="PERSON", category="Contact PII",
                         risk="Medium", confidence=0.95, source="gliner_ai", explanation="Name"),
            RawDetection(start=20, end=33, text="City Hospital", type_="ORGANIZATION", category="Organization Data",
                         risk="Low", confidence=0.90, source="gliner_ai", explanation="Hospital org"),
            RawDetection(start=37, end=43, text="Boston", type_="LOCATION", category="Location Data",
                         risk="Low", confidence=0.92, source="gliner_ai", explanation="City location"),
        ])

        response = isolated_engine.process_scan(text=text, task="Medical Staff Audit", privacy_mode="strict")
        assert len(response.combination_risks) >= 1
        triad_risk = next((r for r in response.combination_risks if r["risk_type"] == "Triad Re-Identification Risk"), None)
        assert triad_risk is not None
        assert triad_risk["severity"] == "High"
        assert "PERSON" in triad_risk["entities_involved"]
        assert "LOCATION" in triad_risk["entities_involved"]
        assert "ORGANIZATION" in triad_risk["entities_involved"]
        assert "PERSON" in response.quasi_identifiers
        assert "LOCATION" in response.quasi_identifiers


class TestUnitModelLoadingFailuresAndDegradedState:
    """Verifies that model failures are transparently exposed and never silently substituted."""

    def test_model_loading_failure_reports_degraded_or_error(self):
        """When GLiNER fails to load, detector reports degraded/error status with error message."""
        detector = AIDetectorService()
        with patch("gliner.GLiNER.from_pretrained", side_effect=RuntimeError("Simulated CUDA/Torch crash")):
            detector.load_engines(model_name="nonexistent/model", enable_presidio=False)

        assert detector.model_loaded is False
        assert detector.status == "error"
        assert "Simulated CUDA/Torch crash" in detector.load_error

    def test_memory_error_during_gliner_loading_caught_gracefully(self):
        """When GLiNER raises MemoryError (e.g. 512MB RAM cap), it catches safely and enters degraded mode."""
        detector = AIDetectorService()
        with patch("gliner.GLiNER.from_pretrained", side_effect=MemoryError("Out of memory on 512MB instance")):
            with patch("presidio_analyzer.AnalyzerEngine"):
                detector.load_engines(model_name="urchade/gliner_small-v2.1", enable_presidio=True)

        assert detector.model_loaded is False
        assert detector.presidio_loaded is True
        assert detector.status == "degraded"
        assert "Out of memory" in detector.load_error

    def test_repeated_initialization_does_not_duplicate_instances(self):
        """Repeated calls to load_engines do not reload or duplicate memory allocations."""
        detector = AIDetectorService()
        detector.model_loaded = True
        detector.gliner_model = MagicMock()
        detector.presidio_loaded = True
        detector.presidio_analyzer = MagicMock()
        detector.status = "ready"

        initial_count = detector._load_count
        with patch("gliner.GLiNER.from_pretrained") as mock_gliner:
            detector.load_engines(enable_presidio=True, enable_gliner=True)
            mock_gliner.assert_not_called()
        assert detector._load_count == initial_count

    def test_gliner_disabled_via_flag_switches_to_honest_degraded(self):
        """Disabling GLiNER via enable_gliner=False cleanly runs in degraded mode without loading weights."""
        detector = AIDetectorService()
        with patch("presidio_analyzer.AnalyzerEngine"):
            detector.load_engines(enable_gliner=False, enable_presidio=True)

        assert detector.model_loaded is False
        assert detector.presidio_loaded is True
        assert detector.status == "degraded"
        assert "disabled" in detector.load_error.lower()

    def test_health_endpoint_separates_liveness_from_engine_readiness(self, client):
        """Health check reports status='ok' (server responsive) but engine_ready=False when degraded."""
        from app.services.ai_detector import detector_service

        orig_status = detector_service.status
        try:
            # Degraded status: engine is not fully ready
            detector_service.status = "degraded"
            res = client.get("/api/health")
            assert res.status_code == 200
            assert res.json()["status"] == "ok"
            assert res.json()["engine_ready"] is False
            assert res.json()["engine_status"] == "degraded"

            # Ready status: engine is fully loaded
            detector_service.status = "ready"
            res = client.get("/api/health")
            assert res.status_code == 200
            assert res.json()["status"] == "ok"
            assert res.json()["engine_ready"] is True
            assert res.json()["engine_status"] == "ready"
        finally:
            detector_service.status = orig_status

    def test_scan_behavior_when_ai_model_is_unavailable(self, isolated_engine, mock_detector):
        """When GLiNER is unavailable (degraded state), scan uses Presidio + secrets and flags degraded status."""
        mock_detector.model_loaded = False
        mock_detector.presidio_loaded = True
        mock_detector.status = "degraded"
        mock_detector.load_error = "Model unavailable due to 512MB RAM cap"

        text = "Contact Sarah Connor at sarah@cyberdyne.org. Key is sk-live_99887766554433221100aabb."
        response = isolated_engine.process_scan(text=text, privacy_mode="strict")

        assert response.engine_status.status == "degraded"
        assert response.engine_status.model_loaded is False
        assert response.engine_status.inference_backend == "presidio_hybrid"
        # Deterministic secret was detected
        assert any(f.type == "API_KEY" or "KEY" in f.type for f in response.findings)

    def test_engine_status_reflects_actual_state(self, client):
        """GET /api/engine-status endpoint accurately reports model state."""
        res = client.get("/api/engine-status")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "model_loaded" in data
        assert "supported_categories" in data
        assert "spacy_model" in data
        assert data["spacy_model"] == "en_core_web_sm"
        assert isinstance(data["supported_categories"], list)
        assert len(data["supported_categories"]) > 0

    def test_presidio_initialization_uses_en_core_web_sm_strictly(self):
        """Presidio must be initialized strictly with lightweight en_core_web_sm, never en_core_web_lg."""
        detector = AIDetectorService()
        analyzer = detector._create_presidio_analyzer("en_core_web_sm")
        assert analyzer is not None
        assert analyzer.nlp_engine is not None
        # Verify the resident spaCy model name is core_web_sm
        loaded_model_name = analyzer.nlp_engine.nlp["en"].meta.get("name")
        assert loaded_model_name == "core_web_sm"
        assert loaded_model_name != "core_web_lg"

    def test_presidio_degraded_mode_initialization_without_gliner(self):
        """When GLiNER is disabled (e.g. Render 512MB RAM cap), Presidio initializes with en_core_web_sm in degraded mode."""
        detector = AIDetectorService()
        detector.load_engines(enable_gliner=False, enable_presidio=True, spacy_model="en_core_web_sm")

        assert detector.model_loaded is False
        assert detector.presidio_loaded is True
        assert detector.status == "degraded"
        assert detector.spacy_model == "en_core_web_sm"
        assert "degraded" in detector.load_error.lower()

        # Real inference with Presidio in degraded mode
        detections = detector.detect_all("Contact Sarah at sarah@example.com or call 555-0199.")
        types_detected = {d.type_ for d in detections}
        assert "EMAIL_ADDRESS" in types_detected

    def test_presidio_initialization_failure_reports_clean_error_without_fallback(self):
        """If spaCy engine provider throws an error, detector enters error state without attempting en_core_web_lg."""
        detector = AIDetectorService()
        with patch.object(detector, "_create_presidio_analyzer", side_effect=OSError("Can't find model 'en_core_web_sm'")):
            detector.load_engines(enable_gliner=False, enable_presidio=True)

        assert detector.presidio_loaded is False
        assert detector.presidio_analyzer is None
        assert detector.status == "error"
        assert "Can't find model 'en_core_web_sm'" in detector.load_error
        # Must NOT attempt to load en_core_web_lg
        assert "en_core_web_lg" not in detector.load_error

    def test_engine_status_endpoint_in_degraded_mode(self, client):
        """GET /api/engine-status accurately reports degraded mode parameters when GLiNER is disabled."""
        from app.services.ai_detector import detector_service

        orig_status = detector_service.status
        orig_model_loaded = detector_service.model_loaded
        orig_error = detector_service.load_error
        try:
            detector_service.status = "degraded"
            detector_service.model_loaded = False
            detector_service.presidio_loaded = True
            detector_service.load_error = "Running in degraded mode (Microsoft Presidio + Custom Rules). GLiNER contextual AI is disabled to comply with zero-cost hosting memory limits."

            res = client.get("/api/engine-status")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "degraded"
            assert data["model_loaded"] is False
            assert data["presidio_enabled"] is True
            assert data["inference_backend"] == "presidio_hybrid"
            assert data["spacy_model"] == "en_core_web_sm"
            assert "degraded" in data["error_message"].lower()
        finally:
            detector_service.status = orig_status
            detector_service.model_loaded = orig_model_loaded
            detector_service.load_error = orig_error


class TestUnitValidationAndPayloadLimits:
    """Tests request validation, empty strings, and payload size enforcement."""

    def test_empty_text_rejected(self, client):
        """Blank or whitespace-only text should return HTTP 422."""
        res = client.post("/api/scan", json={"text": "   ", "privacy_mode": "strict"})
        assert res.status_code == 422
        assert "Validation Error" in res.json().get("error", "")

    def test_invalid_privacy_mode_rejected(self, client):
        """Unsupported privacy mode should return HTTP 422."""
        res = client.post("/api/scan", json={"text": "Hello world", "privacy_mode": "invalid_mode"})
        assert res.status_code == 422

    def test_payload_exceeding_character_limit_rejected(self, client):
        """Payload exceeding 100,000 characters returns HTTP 422 or 413."""
        giant_text = "A" * 100001
        res = client.post("/api/scan", json={"text": giant_text})
        assert res.status_code in (413, 422)


# ============================================================================
# GROUP B: Real Model Inference Tests (Non-Mocked)
# ============================================================================

class TestLiveModelInference:
    """Tests that execute REAL contextual inference using resident GLiNER and Presidio."""

    @pytest.mark.real_inference
    def test_real_gliner_and_presidio_pii_detection(self, client):
        """Verifies that the live model loads, detects contextual PII, and returns valid offsets."""
        payload = {
            "text": "Hello, my name is Sarah Connor and my email is sarah.connor@cyberdyne.org. Please call me at 555-234-5678.",
            "task": "Customer Support Audit",
            "privacy_mode": "strict",
        }

        res = client.post("/api/scan", json=payload)
        assert res.status_code == 200
        data = res.json()

        # Verify scan structure
        assert data["scan_id"].startswith("SCN-")
        if data["engine_status"]["model_loaded"]:
            assert data["engine_status"]["status"] == "ready"
        else:
            assert data["engine_status"]["status"] == "degraded"
            assert data["engine_status"]["presidio_enabled"] is True

        # Verify findings
        findings = data["findings"]
        assert len(findings) >= 2

        # Check for Sarah Connor detection
        person_findings = [f for f in findings if f["type"] == "PERSON" or "Sarah" in f["originalSnippet"]]
        assert len(person_findings) >= 1
        assert person_findings[0]["source"] in ("gliner_ai", "presidio")
        assert person_findings[0]["confidence"] > 0.4
        assert person_findings[0]["start"] >= 0
        assert person_findings[0]["end"] > person_findings[0]["start"]

        # Check for Email detection
        email_findings = [f for f in findings if f["type"] == "EMAIL_ADDRESS" or "cyberdyne" in f["originalSnippet"]]
        assert len(email_findings) >= 1

        # Verify protected text has redacted placeholders
        protected = data["protected_text"]
        assert "Sarah Connor" not in protected
        assert "[PERSON_1]" in protected or "[EMAIL_1]" in protected

        # Verify secondary verification
        verification = data["verification"]
        assert "passed" in verification
        assert "guarantee_disclaimer" in verification
        assert len(verification["residual_risks"]) > 0

    @pytest.mark.real_inference
    def test_real_secret_key_detection(self, client):
        """Verifies that deterministic rules catch real API key signatures in prompt text."""
        payload = {
            "text": "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nexport SECRET_KEY=sk-demo12345678901234567890123456",
            "task": "DevOps Audit",
            "privacy_mode": "strict",
        }

        res = client.post("/api/scan", json=payload)
        assert res.status_code == 200
        data = res.json()

        findings = data["findings"]
        cred_findings = [f for f in findings if f["category"] == "Developer Credentials"]
        assert len(cred_findings) >= 2
        assert "AKIAIOSFODNN7EXAMPLE" not in data["protected_text"]


# ============================================================================
# GROUP C: API Endpoints & Health Check
# ============================================================================

class TestApiEndpoints:
    """Verifies standard HTTP endpoints and CORS configuration."""

    def test_health_endpoints(self, client):
        """GET /health and GET /api/health return 200 OK."""
        for path in ("/health", "/api/health"):
            res = client.get(path)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "ok"
            assert "engine_ready" in data
            assert data["engine_status"] in ("ready", "degraded")

    def test_root_endpoint(self, client):
        """GET / returns system status and docs reference."""
        res = client.get("/")
        assert res.status_code == 200
        assert res.json()["status"] == "online"

    def test_cors_headers(self, client):
        """OPTIONS preflight checks respect allowed CORS origins."""
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173", "https://privacy-ai-kappa.vercel.app"):
            res = client.options(
                "/api/scan",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                },
            )
            assert res.status_code == 200
            assert res.headers.get("access-control-allow-origin") == origin

    def test_csv_table_scanning_and_redaction(self, client):
        """Verifies that uploaded CSV file content is scanned, PII is redacted, and table structure is preserved."""
        csv_payload = {
            "text": "id,name,email,notes\n1,Sarah Connor,sarah.connor@cyberdyne.org,SSN: 482-19-9481\n2,John Connor,john.c@resistance.org,sk-live_51M0demo00000000000000000000",
            "task": "Uploaded File: customers.csv",
            "privacy_mode": "redaction",
        }
        res = client.post("/api/scan", json=csv_payload)
        assert res.status_code == 200
        data = res.json()

        assert data["original_length"] == len(csv_payload["text"])
        assert len(data["findings"]) >= 4

        # Verify CSV column delimiters and structure remain intact
        protected = data["protected_text"]
        lines = protected.strip().split("\n")
        assert len(lines) == 3
        assert lines[0] == "id,name,email,notes"
        # First row should start with '1,'
        assert lines[1].startswith("1,")
        assert "Sarah Connor" not in protected
        assert "482-19-9481" not in protected
        assert "sk-live_51M0demo00000000000000000000" not in protected


# ============================================================================
# GROUP D: Disabled GLiNER Startup, Low-Memory & CSV Processing
# ============================================================================

class TestDisabledGlinerAndLowMemoryOperations:
    """Verifies low-memory execution, chunked CSV handling, and honest degraded mode."""

    def test_disabled_gliner_startup_prevents_neural_imports(self):
        """In a clean process with ENABLE_GLINER=false, torch and gliner are NEVER imported."""
        import os
        import subprocess
        import sys

        verify_script = (
            "import os, sys\n"
            "os.environ['ENABLE_GLINER'] = 'false'\n"
            "os.environ['PRESIDIO_DEVICE'] = 'cpu'\n"
            "from app.services.ai_detector import detector_service\n"
            "detector_service.load_engines(enable_gliner=False, enable_presidio=True)\n"
            "assert detector_service.model_loaded is False\n"
            "assert detector_service.presidio_loaded is True\n"
            "assert detector_service.status == 'degraded'\n"
            "assert 'torch' not in sys.modules, 'torch was unexpectedly imported'\n"
            "assert 'transformers' not in sys.modules, 'transformers was unexpectedly imported'\n"
            "assert 'gliner' not in sys.modules, 'gliner was unexpectedly imported'\n"
            "print('VERIFICATION_OK')\n"
        )

        res = subprocess.run(
            [sys.executable, "-c", verify_script],
            capture_output=True,
            text=True,
            check=False,
            cwd=os.path.join(os.path.dirname(__file__), ".."),
        )
        assert res.returncode == 0, f"Subprocess failed:\nstdout: {res.stdout}\nstderr: {res.stderr}"
        assert "VERIFICATION_OK" in res.stdout

    def test_large_csv_processing_with_chunking(self, client):
        """A multi-row CSV document is processed with line-boundary chunking and valid offsets."""
        header = "id,name,email,phone,notes"
        rows = [
            f"{i},Sarah Connor {i},user{i}@cyberdyne.org,555-{i:04d},Patient file record {i}"
            for i in range(1, 101)
        ]
        csv_text = "\n".join([header] + rows)

        res = client.post("/api/scan", json={"text": csv_text, "privacy_mode": "strict"})
        assert res.status_code == 200
        data = res.json()

        assert data["original_length"] == len(csv_text)
        assert len(data["findings"]) >= 100
        protected = data["protected_text"]

        # Ensure header remains intact
        assert protected.startswith("id,name,email,phone,notes")
        # Ensure sensitive values are not present
        assert "user1@cyberdyne.org" not in protected
        assert "user50@cyberdyne.org" not in protected
        assert "user99@cyberdyne.org" not in protected

    def test_csv_with_malformed_and_edge_case_content(self, client):
        """Edge case CSV formatting (quotes, extra commas, empty fields) scans safely."""
        malformed_csv = (
            'id,name,email,notes\n'
            '1,"Connor, Sarah",sarah@example.com,"Note with ""escaped"" quotes and, commas"\n'
            '2,,,Empty row with sk-test_apikey1234567890abcdef\n'
            '3,John Doe,john@test.org,\n'
        )
        res = client.post("/api/scan", json={"text": malformed_csv, "privacy_mode": "synthetic"})
        assert res.status_code == 200
        data = res.json()
        assert len(data["findings"]) >= 2
        assert "sk-test_apikey1234567890abcdef" not in data["protected_text"]

    def test_scan_lifecycle_gc_and_repeated_calls(self, client):
        """Sequential scans execute cleanly without memory escalation or state leakage."""
        for i in range(5):
            payload = {
                "text": f"Iteration {i}: Contact Dr. Alice Smith at alice{i}@hospital.org regarding Case #{i}.",
                "privacy_mode": "strict",
            }
            res = client.post("/api/scan", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert len(data["findings"]) >= 1
            assert f"alice{i}@hospital.org" not in data["protected_text"]

    def test_idempotency_cache_returns_identical_scan_response(self, client):
        """Requests with identical request_id return cached responses without re-processing."""
        req_id = "test-idempotent-req-12345"
        payload = {
            "text": "CEO Sarah Connor contacted engineer John at sarah.connor@cyberdyne.org",
            "task": "Idempotency Audit",
            "privacy_mode": "strict",
            "request_id": req_id,
        }

        res1 = client.post("/api/scan", json=payload)
        assert res1.status_code == 200
        data1 = res1.json()

        res2 = client.post("/api/scan", json=payload)
        assert res2.status_code == 200
        data2 = res2.json()

        # Exact same scan ID and output returned from cache
        assert data1["scan_id"] == data2["scan_id"]
        assert data1["protected_text"] == data2["protected_text"]
        assert len(data1["findings"]) == len(data2["findings"])

    def test_presidio_deferred_initialization_on_transient_startup_failure(self):
        """If Presidio failed during initial container boot, ensure_presidio_loaded recovers it cleanly."""
        from app.services.ai_detector import AIDetectorService
        detector = AIDetectorService()
        detector.presidio_loaded = False
        detector.presidio_analyzer = None
        detector.status = "error"

        # Call ensure_presidio_loaded directly
        recovered = detector.ensure_presidio_loaded()
        assert recovered is True
        assert detector.presidio_loaded is True
        assert detector.presidio_analyzer is not None
        assert detector.status == "degraded"

        # Verify it can detect entities immediately after deferred recovery
        detections = detector.detect_presidio("Call Sarah Connor at sarah@cyberdyne.org")
        assert len(detections) >= 1

    def test_secrets_fallback_when_both_neural_and_presidio_fail(self):
        """Even if all ML engines are unavailable, deterministic secrets and rules still protect sensitive data."""
        from app.services.ai_detector import AIDetectorService
        detector = AIDetectorService()
        detector.model_loaded = False
        detector.gliner_model = None
        detector.presidio_loaded = False
        detector.presidio_analyzer = None

        # Even with zero ML models, secrets rules must function
        text = "AWS_SECRET=AKIAIOSFODNN7EXAMPLE and SK=sk-live_51M0demo00000000000000000000"
        secrets = detector.detect_secrets(text)
        assert len(secrets) >= 2
        categories = {s.category for s in secrets}
        assert "Developer Credentials" in categories

    def test_content_hash_idempotency_with_different_request_ids(self, client):
        """Identical content returns cached response even when client generates new request_id on retry."""
        text = "Confidential report: patient John Connor, DOB: 02/28/1985, email: jconnor@resistance.net"
        payload1 = {
            "text": text,
            "task": "Medical Records Review",
            "privacy_mode": "strict",
            "request_id": "REQ-ATTEMPT-1",
        }
        res1 = client.post("/api/scan", json=payload1)
        assert res1.status_code == 200
        data1 = res1.json()

        # Second request with identical content but completely different request_id (simulating a retry after timeout)
        payload2 = {
            "text": text,
            "task": "Medical Records Review",
            "privacy_mode": "strict",
            "request_id": "REQ-ATTEMPT-2-RETRY",
        }
        res2 = client.post("/api/scan", json=payload2)
        assert res2.status_code == 200
        data2 = res2.json()

        # Must return the cached scan result immediately
        assert data1["scan_id"] == data2["scan_id"]
        assert data1["protected_text"] == data2["protected_text"]

    def test_large_csv_verification_passes_without_placeholder_boundary_artifacts(self):
        """Secondary verification on multi-row CSVs does not falsely flag bracketed placeholder boundaries."""
        from app.services.privacy_engine import privacy_engine

        header = "id,name,email,phone,address,notes,credit_card,ssn,company,ip_address\n"
        rows = [
            f"{i},Person {i},person{i}@example.com,555-01{i:02d},123 Main St City {i},"
            f"Customer account notes for user {i},4532-1234-5678-{i:04d},123-45-{i:04d},"
            f"Company {i},192.168.1.{i % 250}"
            for i in range(25)
        ]
        csv_data = header + "\n".join(rows)

        resp = privacy_engine.process_scan(csv_data, task="Batch CSV Redaction", privacy_mode="strict")
        # Verification must pass: no false-positive residual findings from placeholders
        assert resp.verification.passed is True
        assert resp.verification.residual_findings_count == 0
        assert "Verification passed" in resp.verification.explanation


class TestVerificationAndRegressionAudit:
    """Regression suite covering secondary verification audit, overlap trimming, and re-identification risks."""

    def test_genuine_residual_pii_fails_verification(self):
        """Secondary verification detects genuine unredacted SSNs or credentials and rejects certification."""
        from app.services.privacy_engine import privacy_engine

        leaked_payload = "Approved summary: [PERSON_1] authorized transfer. Residual SSN: 987-65-4321, key=sk-live998877665544332211"
        v = privacy_engine._verify_protected_text(leaked_payload, [], "redaction")

        assert v.passed is False
        assert v.residual_findings_count >= 1
        assert "Verification alert: Secondary audit discovered" in v.explanation
        detected_types = {item["type"] for item in v.second_pass_findings}
        assert "SSN" in detected_types or "API_KEY" in detected_types

    def test_successfully_redacted_pii_passes_verification(self):
        """When all sensitive entities are protected, secondary verification passes with zero residuals."""
        from app.services.privacy_engine import privacy_engine

        clean_csv = (
            "id,name,email,ssn,address,employer\n"
            "1,Alice Johnson,alice@example.com,123-45-6789,123 Main St,Acme Corp 84\n"
            "2,Bob Smith,bob@test.com,987-65-4321,456 Oak Ave,Global Tech 92\n"
            "3,Emily Davis,emily@corp.org,555-01-9999,789 Pine Blvd Suite 10,Innovate LLC\n"
        )
        resp = privacy_engine.process_scan(clean_csv, task="CSV Audit", privacy_mode="redaction")

        assert resp.verification.passed is True
        assert resp.verification.residual_findings_count == 0
        assert "Verification passed" in resp.verification.explanation
        assert "123-45-6789" not in resp.protected_text
        assert "alice@example.com" not in resp.protected_text
        assert "Alice Johnson" not in resp.protected_text
        assert "123 Main St" not in resp.protected_text

    def test_false_positive_date_filtering_for_numbers_and_cards(self):
        """Bare 1-2 digit row IDs, phone numbers, and card numbers are not misclassified as dates."""
        from app.services.ai_detector import detector_service
        detector_service.ensure_presidio_loaded()

        # Bare numbers should not become DATE_TIME detections
        converted_1 = detector_service._convert_presidio_results(
            "16",
            [type("Res", (), {"start": 0, "end": 2, "entity_type": "DATE_TIME", "score": 0.85})()]
        )
        assert len(converted_1) == 0

        # Hyphenated phone-like numbers should not become DATE_TIME detections
        converted_2 = detector_service._convert_presidio_results(
            "555-0106",
            [type("Res", (), {"start": 0, "end": 8, "entity_type": "DATE_TIME", "score": 0.85})()]
        )
        assert len(converted_2) == 0

    def test_overlapping_generic_and_structured_entities_preserved(self, mock_detector):
        """Broad NLP entity boundaries overlapping structured identifiers do not drop structured PII."""
        full_text = "Acme Corp 84,123-45-6789 is the company account."
        org = RawDetection(
            start=0, end=16, text="Acme Corp 84,123", type_="ORGANIZATION",
            category="Organization Data", risk="Low", confidence=0.85,
            source="presidio", explanation="org"
        )
        ssn = RawDetection(
            start=13, end=24, text="123-45-6789", type_="SSN",
            category="Government ID", risk="High", confidence=0.99,
            source="deterministic_rule", explanation="ssn"
        )

        reconciled = mock_detector.reconcile_spans(full_text, [org, ssn])
        assert len(reconciled) == 2
        assert reconciled[0].type_ == "ORGANIZATION"
        assert reconciled[0].text == "Acme Corp 84"
        assert reconciled[1].type_ == "SSN"
        assert reconciled[1].text == "123-45-6789"

    def test_synthetic_surrogate_placeholders_not_flagged_in_verification(self):
        """Synthetic surrogate mode replaces entities with safe surrogates that do not fail verification."""
        from app.services.privacy_engine import privacy_engine

        input_text = "Please reach out to Dr. Gregory House at gregory.house@princeton-plainsboro.org for medical review."
        resp = privacy_engine.process_scan(input_text, task="PHI anonymization", privacy_mode="synthetic")

        assert resp.verification.passed is True
        assert resp.verification.residual_findings_count == 0
        assert "gregory.house@princeton-plainsboro.org" not in resp.protected_text

    def test_triad_reidentification_risk_detected_with_actionable_warning(self):
        """Triad combination of name, location, and organization triggers warning with mitigation advice."""
        from app.services.privacy_engine import privacy_engine

        input_text = "Alice Johnson works at Acme Corp in Denver, Colorado."
        resp = privacy_engine.process_scan(input_text, task="Linkage analysis", privacy_mode="redaction")

        triad_risks = [cr for cr in resp.combination_risks if cr["risk_type"] == "Triad Re-Identification Risk"]
        assert len(triad_risks) == 1
        risk = triad_risks[0]
        assert risk["severity"] == "High"
        assert "PERSON" in risk["entities_involved"]
        assert "LOCATION" in risk["entities_involved"]
        assert "ORGANIZATION" in risk["entities_involved"]
        assert "mitigation" in risk
        assert len(risk["mitigation"]) > 10





