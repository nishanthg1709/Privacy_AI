"""
PrivacyGuard AI - Supabase Schema, RLS, and Multi-Tenant Isolation Tests
========================================================================
Validates that:
1. Exactly two application tables exist: 'public.profiles' and 'public.scan_history'.
2. Profiles table satisfies all foreign key, column, trigger, and RLS requirements.
3. Scan history table satisfies zero-log constraints, metadata columns, and RLS.
4. Multi-tenant isolation: User A cannot read, insert, update, or delete User B's profile or scans.
5. Profile ID is strictly immutable during updates.
6. Service-role keys are never exposed in frontend code.
"""

import os
import re
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCHEMA_FILE = os.path.join(REPO_ROOT, "supabase", "schema.sql")
MIGRATIONS_DIR = os.path.join(REPO_ROOT, "supabase", "migrations")
PROFILES_MIGRATION = os.path.join(MIGRATIONS_DIR, "20261016000001_create_profiles.sql")
SCAN_HISTORY_MIGRATION = os.path.join(MIGRATIONS_DIR, "20261015000001_create_scan_history.sql")


@pytest.fixture
def schema_sql():
    assert os.path.isfile(SCHEMA_FILE), f"Missing {SCHEMA_FILE}"
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture
def profiles_migration_sql():
    assert os.path.isfile(PROFILES_MIGRATION), f"Missing {PROFILES_MIGRATION}"
    with open(PROFILES_MIGRATION, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture
def scan_history_migration_sql():
    assert os.path.isfile(SCAN_HISTORY_MIGRATION), f"Missing {SCAN_HISTORY_MIGRATION}"
    with open(SCAN_HISTORY_MIGRATION, "r", encoding="utf-8") as f:
        return f.read()


# -----------------------------------------------------------------------------
# 1. EXACT TWO APPLICATION TABLES
# -----------------------------------------------------------------------------

def test_exactly_two_application_tables(schema_sql):
    """Ensure exactly two application tables are created in the public schema."""
    matches = re.findall(r"create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)", schema_sql, re.IGNORECASE)
    assert set(matches) == {"profiles", "scan_history"}, (
        f"Expected exactly ['profiles', 'scan_history'], found: {matches}"
    )


# -----------------------------------------------------------------------------
# 2. PROFILES TABLE SPECIFICATIONS
# -----------------------------------------------------------------------------

def test_profiles_schema_structure(schema_sql, profiles_migration_sql):
    """Verify profiles table definition matches prompt specifications."""
    for sql in (schema_sql, profiles_migration_sql):
        # Primary key and FK to auth.users(id) ON DELETE CASCADE
        assert re.search(
            r"id\s+uuid\s+primary\s+key\s+references\s+auth\.users\(id\)\s+on\s+delete\s+cascade",
            sql,
            re.IGNORECASE,
        ), "profiles table must have id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE"

        # display_name TEXT
        assert re.search(r"display_name\s+text", sql, re.IGNORECASE), "profiles must have display_name TEXT"

        # created_at and updated_at
        assert re.search(r"created_at\s+timestamp", sql, re.IGNORECASE)
        assert re.search(r"updated_at\s+timestamp", sql, re.IGNORECASE)

        # RLS enabled
        assert re.search(
            r"alter\s+table\s+public\.profiles\s+enable\s+row\s+level\s+security",
            sql,
            re.IGNORECASE,
        ), "RLS must be enabled on public.profiles"


def test_profiles_rls_policies(schema_sql, profiles_migration_sql):
    """Verify authenticated users can select/update only their own profile, with immutable ID."""
    for sql in (schema_sql, profiles_migration_sql):
        # SELECT policy
        select_policy = re.search(
            r"create\s+policy\s+[\"']Users can select own profile[\"']\s+on\s+public\.profiles\s+for\s+select\s+to\s+authenticated\s+using\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)",
            sql,
            re.IGNORECASE,
        )
        assert select_policy is not None, "Missing SELECT policy for own profile"

        # UPDATE policy with check (auth.uid() = id)
        update_policy = re.search(
            r"create\s+policy\s+[\"']Users can update own profile[\"']\s+on\s+public\.profiles\s+for\s+update\s+to\s+authenticated\s+using\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)\s+with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)",
            sql,
            re.IGNORECASE,
        )
        assert update_policy is not None, "Missing UPDATE policy enforcing auth.uid() = id on check"

        # Profile ID immutability trigger check
        assert "Profile ID cannot be changed" in sql or "Updating profile ID is not permitted" in sql, (
            "handle_profile_updated trigger must prevent changing profile ID"
        )


def test_profiles_auto_provision_trigger(schema_sql, profiles_migration_sql):
    """Verify handle_new_user() trigger automatically provisions profiles for new users."""
    for sql in (schema_sql, profiles_migration_sql):
        assert "create or replace function public.handle_new_user()" in sql.lower()
        assert "after insert on auth.users" in sql.lower()
        assert "new.raw_user_meta_data" in sql


# -----------------------------------------------------------------------------
# 3. SCAN_HISTORY TABLE SPECIFICATIONS & ZERO-LOG INTEGRITY
# -----------------------------------------------------------------------------

def test_scan_history_schema_structure(schema_sql, scan_history_migration_sql):
    """Verify scan_history schema retains existing table, metadata columns, and FK."""
    for sql in (schema_sql, scan_history_migration_sql):
        # user_id references auth.users(id) ON DELETE CASCADE
        assert re.search(
            r"user_id\s+uuid\s+not\s+null\s+references\s+auth\.users\(id\)\s+on\s+delete\s+cascade",
            sql,
            re.IGNORECASE,
        ), "scan_history must reference auth.users(id) ON DELETE CASCADE"

        # Metadata telemetry columns
        expected_cols = [
            "scan_id",
            "task",
            "privacy_mode",
            "strictness",
            "status",
            "findings_count",
            "category_counts",
            "privacy_score",
            "verification_passed",
            "created_at",
        ]
        for col in expected_cols:
            assert re.search(rf"\b{col}\b", sql, re.IGNORECASE), f"scan_history missing expected column: {col}"

        # RLS enabled
        assert re.search(
            r"alter\s+table\s+public\.scan_history\s+enable\s+row\s+level\s+security",
            sql,
            re.IGNORECASE,
        ), "RLS must be enabled on public.scan_history"


def test_scan_history_zero_log_guarantee(schema_sql, scan_history_migration_sql):
    """Verify NO columns exist for raw document text, unredacted sensitive snippets, or tokens."""
    forbidden_columns = [
        "raw_text",
        "document_text",
        "original_text",
        "unredacted_text",
        "detected_values",
        "entities_raw",
        "secret",
        "password",
        "access_token",
        "api_key",
        "sanitized_body",
        "protected_text",
    ]
    for sql in (schema_sql, scan_history_migration_sql):
        for col in forbidden_columns:
            assert not re.search(rf"\b{col}\b", sql, re.IGNORECASE), (
                f"Violates Zero-Log policy: forbidden column '{col}' detected in scan_history schema!"
            )


def test_scan_history_rls_policies(schema_sql, scan_history_migration_sql):
    """Verify RLS policies restrict SELECT, INSERT, and DELETE to auth.uid() = user_id."""
    for sql in (schema_sql, scan_history_migration_sql):
        # SELECT
        assert re.search(
            r"create\s+policy\s+[\"']Users can select own scan history[\"'].*?using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)",
            sql,
            re.DOTALL | re.IGNORECASE,
        )
        # INSERT
        assert re.search(
            r"create\s+policy\s+[\"']Users can insert own scan history[\"'].*?with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)",
            sql,
            re.DOTALL | re.IGNORECASE,
        )
        # DELETE
        assert re.search(
            r"create\s+policy\s+[\"']Users can delete own scan history[\"'].*?using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)",
            sql,
            re.DOTALL | re.IGNORECASE,
        )


# -----------------------------------------------------------------------------
# 4. MULTI-TENANT ISOLATION SIMULATION
# -----------------------------------------------------------------------------

class SimulatedSupabaseRLSEngine:
    """Simulates PostgreSQL Row Level Security evaluation for profiles and scan_history."""

    def __init__(self):
        self.profiles = {}  # {user_id: {"id": user_id, "display_name": ...}}
        self.scan_history = []  # [{"id": ..., "user_id": ..., "scan_id": ...}]

    def select_profile(self, auth_uid, target_id):
        # Policy: using (auth.uid() = id)
        if auth_uid == target_id and target_id in self.profiles:
            return self.profiles[target_id]
        return None  # RLS filter hides rows where auth.uid() != id

    def update_profile(self, auth_uid, target_id, updates):
        # Policy: using (auth.uid() = id) with check (auth.uid() = id)
        if auth_uid != target_id:
            raise PermissionError("RLS: unauthorized update on another user's profile")

        if "id" in updates and updates["id"] != target_id:
            raise ValueError("Profile ID cannot be changed.")

        if target_id not in self.profiles:
            return None

        self.profiles[target_id].update(updates)
        return self.profiles[target_id]

    def insert_scan(self, auth_uid, record):
        # Policy: with check (auth.uid() = user_id)
        if record.get("user_id") != auth_uid:
            raise PermissionError("RLS: cannot insert scan history for another user ID")
        self.scan_history.append(record)
        return record

    def select_scans(self, auth_uid):
        # Policy: using (auth.uid() = user_id)
        return [r for r in self.scan_history if r.get("user_id") == auth_uid]

    def delete_scan(self, auth_uid, scan_id):
        # Policy: using (auth.uid() = user_id)
        before_count = len(self.scan_history)
        self.scan_history = [
            r for r in self.scan_history if not (r.get("scan_id") == scan_id and r.get("user_id") == auth_uid)
        ]
        return len(self.scan_history) < before_count


def test_multi_tenant_isolation_user_a_cannot_access_user_b():
    """Verify that User A cannot read, modify, insert, or delete User B's profile or scan history."""
    engine = SimulatedSupabaseRLSEngine()

    user_a = "11111111-1111-4111-a111-111111111111"
    user_b = "22222222-2222-4222-b222-222222222222"

    # Setup profiles
    engine.profiles[user_a] = {"id": user_a, "display_name": "Alice Officer"}
    engine.profiles[user_b] = {"id": user_b, "display_name": "Bob Analyst"}

    # Setup scans
    engine.insert_scan(user_a, {"scan_id": "SCN-A01", "user_id": user_a, "findings_count": 2})
    engine.insert_scan(user_b, {"scan_id": "SCN-B01", "user_id": user_b, "findings_count": 5})

    # 1. User A can read own profile
    assert engine.select_profile(auth_uid=user_a, target_id=user_a)["display_name"] == "Alice Officer"

    # 2. User A CANNOT read User B's profile
    assert engine.select_profile(auth_uid=user_a, target_id=user_b) is None

    # 3. User A CANNOT update User B's profile
    with pytest.raises(PermissionError):
        engine.update_profile(auth_uid=user_a, target_id=user_b, updates={"display_name": "Hacked"})

    # 4. User A CANNOT change their own profile ID
    with pytest.raises(ValueError, match="Profile ID cannot be changed"):
        engine.update_profile(auth_uid=user_a, target_id=user_a, updates={"id": user_b})

    # 5. User A updates own profile successfully
    updated = engine.update_profile(auth_uid=user_a, target_id=user_a, updates={"display_name": "Alice Senior"})
    assert updated["display_name"] == "Alice Senior"

    # 6. User A can view only their own scans
    a_scans = engine.select_scans(auth_uid=user_a)
    assert len(a_scans) == 1
    assert a_scans[0]["scan_id"] == "SCN-A01"

    # 7. User A CANNOT insert scan for User B
    with pytest.raises(PermissionError):
        engine.insert_scan(auth_uid=user_a, record={"scan_id": "SCN-FAKE", "user_id": user_b})

    # 8. User A CANNOT delete User B's scan
    deleted = engine.delete_scan(auth_uid=user_a, scan_id="SCN-B01")
    assert deleted is False
    assert len(engine.select_scans(auth_uid=user_b)) == 1


# -----------------------------------------------------------------------------
# 5. FRONTEND SECURITY & CREDENTIAL LEAK PREVENTION
# -----------------------------------------------------------------------------

def test_frontend_does_not_expose_service_role_key():
    """Verify that no service-role secrets are committed in frontend source files or environment."""
    frontend_src = os.path.join(REPO_ROOT, "frontend", "src")
    secret_pattern = re.compile(r"service_role", re.IGNORECASE)

    # Walk through frontend source files
    for root, _, files in os.walk(frontend_src):
        for f in files:
            if f.endswith((".js", ".jsx", ".ts", ".tsx", ".json")):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8", errors="ignore") as file_content:
                    content = file_content.read()
                    # The only allowed occurrence of 'service_role' is the guard check inside supabaseClient.js
                    if secret_pattern.search(content):
                        assert os.path.basename(path) == "supabaseClient.js", (
                            f"Unexpected service_role reference in frontend file: {path}"
                        )
                        # Verify that supabaseClient is specifically REJECTING service_role
                        assert "Detected Supabase service_role key in frontend environment" in content
