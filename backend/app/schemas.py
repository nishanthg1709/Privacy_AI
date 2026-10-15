"""Pydantic data schemas for PrivacyGuard AI request and response contracts."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class Finding(BaseModel):
    """Represents a single detected sensitive entity in the input text."""
    id: int = Field(..., description="Unique 1-based finding identifier")
    type: str = Field(..., description="Canonical entity type (e.g. PERSON, EMAIL_ADDRESS, SSN)")
    category: str = Field(..., description="High-level category (e.g. Contact PII, Financial Data, Government ID)")
    originalSnippet: str = Field(..., description="Exact raw text segment that was detected")
    sanitizedSnippet: str = Field(..., description="Replacement token or placeholder used in output text")
    start: int = Field(..., ge=0, description="0-based start character offset in original text")
    end: int = Field(..., ge=0, description="0-based end character offset (exclusive) in original text")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score (0.0 - 1.0)")
    risk: str = Field(..., description="Severity level: High, Medium, or Low")
    action: str = Field(..., description="Action taken: Redacted, Masked, Substituted, Proposed Redaction, or Kept")
    source: str = Field(..., description="Detection engine source: gliner_ai, presidio, or deterministic_rule")
    explanation: str = Field(..., description="Human-readable explanation of why entity was flagged")
    is_ambiguous: bool = Field(False, description="Flagged true if contextual relevance requires human audit")
    ambiguity_reason: Optional[str] = Field(None, description="Explanation of ambiguity if flagged")


class EngineStatus(BaseModel):
    """Health and operational readiness status of the AI and complementary engines."""
    status: str = Field(..., description="'ready' when model is live, 'degraded' if running partial engine, 'error' if failed")
    model_name: str = Field(..., description="Name or identifier of the pretrained contextual model")
    model_loaded: bool = Field(..., description="True if real AI model is resident in memory and inferring")
    device: str = Field(..., description="Compute device: cpu, mps, or cuda")
    inference_backend: str = Field(..., description="Active backend engine pipeline")
    presidio_enabled: bool = Field(..., description="True if Microsoft Presidio recognizer is active")
    supported_categories: List[str] = Field(..., description="List of all supported entity categories")
    error_message: Optional[str] = Field(None, description="Detailed diagnostic error message if in degraded/error state")


class VerificationResult(BaseModel):
    """Results from a secondary validation pass over the protected text."""
    passed: bool = Field(..., description="True if no unexpected sensitive entities remain in protected text")
    residual_findings_count: int = Field(..., ge=0, description="Number of sensitive entities found in 2nd pass")
    residual_risks: List[str] = Field(default_factory=list, description="Descriptions of any detected residual risks")
    second_pass_findings: List[Dict[str, Any]] = Field(default_factory=list, description="Raw finding descriptors from 2nd pass")
    explanation: str = Field(..., description="Explanation of verification outcome")
    guarantee_disclaimer: str = Field(
        default="Notice: Automated contextual PII detection and minimization significantly reduces risk but does not guarantee 100% mathematical certainty. Sensitive or regulated workflows should pair automated scans with human review.",
        description="Transparent safety disclaimer regarding automated AI protection limits"
    )


class ScanRequest(BaseModel):
    """Input payload for POST /api/scan endpoint."""
    text: str = Field(..., min_length=1, max_length=100000, description="Raw text or document to scan (max 100,000 chars)")
    task: Optional[str] = Field("Prompt Privacy Audit", max_length=200, description="Task context or audit description")
    privacy_mode: Optional[str] = Field("strict", description="Privacy mode: 'strict', 'task-aware', 'user-approved', 'synthetic', 'tokenized', 'redaction'")
    strictness: Optional[str] = Field("gdpr-hipaa", description="Compliance strictness: 'gdpr-hipaa', 'standard', 'secrets-only'")

    @field_validator("text")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Input text cannot be blank or contain only whitespace.")
        return v

    @field_validator("privacy_mode")
    @classmethod
    def normalize_mode(cls, v: Optional[str]) -> str:
        if not v:
            return "strict"
        cleaned = v.strip().lower()
        valid = {"strict", "task-aware", "user-approved", "synthetic", "tokenized", "redaction"}
        if cleaned not in valid:
            raise ValueError(f"Invalid privacy_mode '{v}'. Must be one of: {', '.join(sorted(valid))}")
        return cleaned


class ScanResponse(BaseModel):
    """Output payload from POST /api/scan endpoint."""
    scan_id: str = Field(..., description="Unique scan execution identifier (e.g. SCN-...)")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of the scan")
    privacy_mode: str = Field(..., description="Active privacy mode applied during scan")
    task: str = Field(..., description="Task context label")
    original_length: int = Field(..., description="Length in characters of original text")
    protected_length: int = Field(..., description="Length in characters of protected text")
    protected_text: str = Field(..., description="Final minimized or redacted text output")
    sanitized_text: str = Field(..., description="Alias of protected_text for frontend compatibility")
    findings: List[Finding] = Field(default_factory=list, description="Detailed list of detected sensitive entities")
    summary: str = Field(..., description="Human-readable summary of scan results")
    counts: Dict[str, int] = Field(default_factory=dict, description="Summary counts by severity level")
    categories: List[str] = Field(default_factory=list, description="Unique categories detected")
    actions: List[str] = Field(default_factory=list, description="Unique actions taken")
    privacy_score: float = Field(..., ge=0.0, le=100.0, description="Estimated privacy preservation score (0-100)")
    engine_status: EngineStatus = Field(..., description="State of the detection engines during this scan")
    verification: VerificationResult = Field(..., description="Secondary verification audit results")


class HealthResponse(BaseModel):
    """Output payload from GET /health or GET /api/health."""
    status: str = Field(..., description="'ok' if server is healthy")
    service: str = Field("PrivacyGuard AI Backend", description="Service identifier")
    version: str = Field("1.0.0", description="API version")
    engine_ready: bool = Field(..., description="True if local AI engine is loaded")
