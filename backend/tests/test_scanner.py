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

    def test_engine_status_reflects_actual_state(self, client):
        """GET /api/engine-status endpoint accurately reports model state."""
        res = client.get("/api/engine-status")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "model_loaded" in data
        assert "supported_categories" in data
        assert isinstance(data["supported_categories"], list)
        assert len(data["supported_categories"]) > 0


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
        assert data["engine_status"]["model_loaded"] is True
        assert data["engine_status"]["status"] == "ready"

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
            assert data["engine_ready"] is True

    def test_root_endpoint(self, client):
        """GET / returns system status and docs reference."""
        res = client.get("/")
        assert res.status_code == 200
        assert res.json()["status"] == "online"

    def test_cors_headers(self, client):
        """OPTIONS preflight checks respect allowed CORS origins."""
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            res = client.options(
                "/api/scan",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                },
            )
            assert res.status_code == 200
            assert res.headers.get("access-control-allow-origin") == origin
