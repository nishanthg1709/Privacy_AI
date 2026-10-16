"""
PrivacyGuard AI - Comprehensive End-to-End Audit & Verification Tests
=====================================================================
Validates all aspects of:
1. Authentication & Protected Routes contracts
2. Profiles & Scan History schema and RLS policies
3. Live AI Scanner execution with resident GLiNER & Presidio
4. Error handling: empty input, invalid modes, oversized payloads
5. Dynamic verification pass (ensuring zero fabricated verification)
6. Zero-log policy enforcement (no sensitive tokens or original text in persistence models)
7. Security checks (no service-role keys in frontend, RLS policy integrity)
"""

import os
import re
import pytest
from fastapi.testclient import TestClient

from app.main import app

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


@pytest.fixture(scope="module")
def client():
    """TestClient that initializes FastAPI lifespan (loads GLiNER & Presidio)."""
    with TestClient(app) as test_client:
        yield test_client


# -----------------------------------------------------------------------------
# 1. LIVE BACKEND AI SCANNER TESTS
# -----------------------------------------------------------------------------

def test_live_scan_successful_detection_and_protection(client):
    """Verify backend performs actual contextual detection, protection, and verification."""
    payload = {
        "text": "Please contact Director Sarah Connor at sarah.connor@cyberdyne.org. Her private key is sk-live-11223344556677889900aabbccdd.",
        "task": "Executive Protection",
        "privacy_mode": "synthetic",
        "strictness": "gdpr-hipaa",
    }
    response = client.post("/api/scan", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Structural contracts
    assert data["scan_id"].startswith("SCN-")
    assert "protected_text" in data
    assert "findings" in data
    assert len(data["findings"]) >= 2  # Sarah Connor, email, private key

    # Verification contract
    assert "verification" in data
    assert "passed" in data["verification"]
    assert "residual_findings_count" in data["verification"]
    assert isinstance(data["verification"]["residual_risks"], list)
    assert data["verification"]["passed"] is True
    assert data["verification"]["residual_findings_count"] == 0

    # Ensure sensitive credentials were removed from protected_text
    assert "sk-live-11223344556677889900aabbccdd" not in data["protected_text"]


def test_live_scan_strict_redaction_mode(client):
    """Verify strict mode generates consistent placeholders and passes verification."""
    payload = {
        "text": "Sarah Connor met with Sarah Connor at sarah.connor@cyberdyne.org.",
        "task": "Identity Audit",
        "privacy_mode": "strict",
        "strictness": "gdpr-hipaa",
    }
    response = client.post("/api/scan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "[PERSON_1]" in data["protected_text"]
    assert data["verification"]["passed"] is True
    assert data["verification"]["residual_findings_count"] == 0


def test_scan_empty_input_rejected(client):
    """Verify backend rejects empty string with HTTP 422."""
    response = client.post("/api/scan", json={"text": ""})
    assert response.status_code == 422


def test_scan_whitespace_only_rejected(client):
    """Verify backend rejects whitespace-only string with HTTP 422."""
    response = client.post("/api/scan", json={"text": "     \n\t  "})
    assert response.status_code == 422
    assert "Input text cannot be blank" in response.text


def test_scan_invalid_privacy_mode_rejected(client):
    """Verify backend rejects unsupported privacy modes with HTTP 422."""
    response = client.post("/api/scan", json={"text": "Valid prompt text", "privacy_mode": "bogus_mode"})
    assert response.status_code == 422
    assert "Invalid privacy_mode" in response.text


def test_scan_oversized_payload_rejected(client):
    """Verify backend rejects payloads exceeding 100,000 characters with HTTP 422."""
    oversized = "A" * 100001
    response = client.post("/api/scan", json={"text": oversized})
    assert response.status_code == 422


def test_health_and_engine_status_endpoints(client):
    """Verify health and engine status endpoints return 200 and operational details."""
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "ok"
    assert health_res.json()["engine_ready"] is True

    engine_res = client.get("/api/engine-status")
    assert engine_res.status_code == 200
    assert engine_res.json()["model_loaded"] is True
    assert "gliner" in engine_res.json()["model_name"].lower()


# -----------------------------------------------------------------------------
# 2. VERIFICATION CONTRACT & DYNAMIC EVALUATION
# -----------------------------------------------------------------------------

def test_dynamic_verification_detects_unredacted_content(client):
    """Verify secondary verification pass dynamically detects unmitigated residual risk."""
    from app.services.privacy_engine import privacy_engine

    # 1. Verification on unredacted text with PII: must fail verification
    unredacted_text = "Director Sarah Connor can be reached at sarah.connor@cyberdyne.org."
    failed_verification = privacy_engine._verify_protected_text(
        protected_text=unredacted_text,
        original_detections=[],
        privacy_mode="strict",
    )
    assert failed_verification.passed is False
    assert failed_verification.residual_findings_count > 0
    assert "Secondary audit discovered" in failed_verification.explanation

    # 2. Verification on clean non-PII text: must pass verification
    clean_text = "This document contains standard operating procedures."
    passed_verification = privacy_engine._verify_protected_text(
        protected_text=clean_text,
        original_detections=[],
        privacy_mode="strict",
    )
    assert passed_verification.passed is True
    assert passed_verification.residual_findings_count == 0
    assert "Verification passed" in passed_verification.explanation


# -----------------------------------------------------------------------------
# 3. SCHEMA, RLS, AND ZERO-LOG AUDIT
# -----------------------------------------------------------------------------

def test_profiles_migration_schema_and_rls():
    """Verify public.profiles migration enforces foreign key cascade and RLS."""
    profiles_sql = os.path.join(REPO_ROOT, "supabase", "migrations", "20261016000001_create_profiles.sql")
    with open(profiles_sql, "r", encoding="utf-8") as f:
        content = f.read()

    # Foreign key relationship to auth.users
    assert "references auth.users(id) on delete cascade" in content.lower()
    # RLS enabled
    assert "alter table public.profiles enable row level security" in content.lower()
    # Policies restricting access to own profile
    assert "auth.uid() = id" in content
    # Immutable profile ID check trigger
    assert "Profile ID cannot be changed" in content


def test_scan_history_migration_schema_and_zero_log_policy():
    """Verify scan_history migration has user foreign key, RLS, and no raw text columns."""
    history_sql = os.path.join(REPO_ROOT, "supabase", "migrations", "20261015000001_create_scan_history.sql")
    with open(history_sql, "r", encoding="utf-8") as f:
        content = f.read()

    assert "references auth.users(id) on delete cascade" in content.lower()
    assert "alter table public.scan_history enable row level security" in content.lower()
    assert "auth.uid() = user_id" in content

    # Zero-log check: verify no column stores raw document or protected document text
    assert "raw_text" not in content.lower()
    assert "original_text" not in content.lower()
    assert "protected_text" not in content.lower()
    assert "unredacted" not in content.lower()


# -----------------------------------------------------------------------------
# 4. FRONTEND INTEGRATION & SECURITY CONTRACTS
# -----------------------------------------------------------------------------

def test_scanner_service_exports_scan_document():
    """Verify frontend/src/services/scannerService.js exports scanDocument alias."""
    scanner_service_file = os.path.join(REPO_ROOT, "frontend", "src", "services", "scannerService.js")
    with open(scanner_service_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "scanDocument" in content, "scannerService.js must export scanDocument"
    assert "export const scanDocument = scanPayload" in content or "scanDocument: scanPayload" in content


def test_protected_route_prevents_unauthenticated_access():
    """Verify frontend/src/components/ProtectedRoute.jsx redirects unauthenticated users."""
    protected_route_file = os.path.join(REPO_ROOT, "frontend", "src", "components", "ProtectedRoute.jsx")
    with open(protected_route_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "!isAuthenticated" in content
    assert '<Navigate to="/login"' in content


def test_footer_does_not_contain_engine_ready_badge():
    """Verify landing page footer does NOT contain the removed status pill."""
    footer_file = os.path.join(REPO_ROOT, "frontend", "src", "components", "Footer.jsx")
    with open(footer_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Local AI Engine Ready" not in content, "Footer must not contain Local AI Engine Ready badge"


def test_no_service_role_key_in_frontend():
    """Verify no service-role secrets or admin keys are configured or exposed in frontend."""
    frontend_env = os.path.join(REPO_ROOT, "frontend", ".env")
    if os.path.exists(frontend_env):
        with open(frontend_env, "r", encoding="utf-8") as f:
            env_content = f.read()
            assert "SERVICE_ROLE" not in env_content.upper()
            assert "SERVICE_KEY" not in env_content.upper()

    # Verify supabaseClient.js explicitly guards against service role keys
    client_file = os.path.join(REPO_ROOT, "frontend", "src", "services", "supabaseClient.js")
    with open(client_file, "r", encoding="utf-8") as f:
        client_code = f.read()
    assert "isServiceRoleKey" in client_code
    assert "NEVER exposes or accepts service-role / admin secret keys" in client_code
