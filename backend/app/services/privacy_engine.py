"""Privacy Engine Service for PrivacyGuard AI.

Provides:
- Multi-mode privacy protection: 'strict', 'task-aware', 'user-approved', 'synthetic', 'tokenized', 'redaction'
- Consistent entity placeholders ([PERSON_1], [EMAIL_1], etc.)
- Task-relevance evaluation with explicit documented rules and ambiguity flags
- Secondary verification pass to audit protected text and report residual risks
- Zero-log policy for sensitive documents and detected values
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional, Set

from app.schemas import Finding, VerificationResult, ScanResponse, EngineStatus
from app.services.ai_detector import AIDetectorService, RawDetection, detector_service

logger = logging.getLogger("privacy_engine.core")

# Synthetic data pools for 'synthetic' mode substitution
SYNTHETIC_POOLS: Dict[str, List[str]] = {
    "PERSON": ["Alex Morgan", "Taylor Reed", "Jordan Hayes", "Casey Bennett", "Morgan Brooks"],
    "EMAIL_ADDRESS": ["user.test@example.org", "audit.sample@demomail.net", "privacy.proxy@testdomain.com"],
    "PHONE_NUMBER": ["+1 (555) 019-2831", "+1 (555) 014-9922", "+1 (555) 018-7744"],
    "LOCATION": ["100 Innovation Way, Suite 400", "742 Evergreen Terrace", "500 Market Street"],
    "SSN": ["999-00-1234", "999-00-5678", "999-00-9876"],
    "CREDIT_CARD": ["4111-2222-3333-4444", "5500-0000-0000-0004", "3782-822463-10005"],
    "BANK_ACCOUNT": ["987654321098", "123456789012"],
    "API_KEY": ["DEMO_SEC_KEY_REPLACED_000000000000", "DEMO_TOKEN_X99_SAMPLE_VALUE"],
    "SECRET_KEY": ["REDACTED_SECRET_KEY_PLACEHOLDER", "DEMO_CONFIG_SECRET_VALUE"],
    "MEDICAL_CONDITION": ["non-specific respiratory condition", "mild chronic fatigue"],
    "MRN": ["MRN-000000", "MRN-999999"],
    "ORGANIZATION": ["Acme Corp Global", "Apex Enterprises", "Standard Dynamic Inc"],
    "IP_ADDRESS": ["192.0.2.1", "198.51.100.25", "203.0.113.10"],
}


class PrivacyEngine:
    """Core privacy minimization and protection engine."""

    def __init__(self, detector: Optional[AIDetectorService] = None):
        self.detector = detector or detector_service

    def process_scan(
        self,
        text: str,
        task: str = "Prompt Privacy Audit",
        privacy_mode: str = "strict",
        strictness: str = "gdpr-hipaa",
    ) -> ScanResponse:
        """Execute end-to-end privacy audit and redaction pipeline."""
        scan_id = f"SCN-{uuid.uuid4().hex[:10].upper()}"
        start_time = datetime.now(timezone.utc).isoformat()
        mode = (privacy_mode or "strict").strip().lower()
        task_label = (task or "Prompt Privacy Audit").strip()

        logger.info("Initiating scan id=%s, task='%s', mode='%s', text_len=%d", scan_id, task_label, mode, len(text))

        # 1. Primary detection pass using AI detector and complementary recognizers
        raw_detections = self.detector.detect_all(text)

        # 2. Filter detections according to compliance strictness level
        filtered_detections = self._apply_strictness_filter(raw_detections, strictness)

        # 3. Generate consistent placeholders and transform text according to privacy_mode
        findings, protected_text = self._apply_protection_mode(
            text=text,
            detections=filtered_detections,
            task=task_label,
            privacy_mode=mode,
        )

        # 4. Secondary verification pass over protected text
        verification = self._verify_protected_text(
            protected_text=protected_text,
            original_detections=findings,
            privacy_mode=mode,
        )

        # 5. Compute summary, metrics, and privacy score
        counts = {
            "total": len(findings),
            "high": sum(1 for f in findings if f.risk == "High"),
            "medium": sum(1 for f in findings if f.risk == "Medium"),
            "low": sum(1 for f in findings if f.risk == "Low"),
        }
        categories = sorted(list({f.category for f in findings}))
        actions = sorted(list({f.action for f in findings}))
        privacy_score = self._compute_privacy_score(findings, verification)
        summary = self._generate_summary(findings, mode, task_label, verification)

        engine_status = EngineStatus(
            status=self.detector.status,
            model_name=self.detector.model_name,
            model_loaded=self.detector.model_loaded,
            device=self.detector.device,
            inference_backend="gliner_pytorch" if self.detector.model_loaded else "presidio_hybrid",
            presidio_enabled=self.detector.presidio_loaded,
            supported_categories=self.detector.get_supported_categories(),
            error_message=self.detector.load_error,
        )

        logger.info(
            "Scan %s complete: %d findings, %d high risk, verification passed=%s",
            scan_id,
            len(findings),
            counts["high"],
            verification.passed,
        )

        return ScanResponse(
            scan_id=scan_id,
            timestamp=start_time,
            privacy_mode=mode,
            task=task_label,
            original_length=len(text),
            protected_length=len(protected_text),
            protected_text=protected_text,
            sanitized_text=protected_text,
            findings=findings,
            summary=summary,
            counts=counts,
            categories=categories,
            actions=actions,
            privacy_score=privacy_score,
            engine_status=engine_status,
            verification=verification,
        )

    def _apply_strictness_filter(
        self, detections: List[RawDetection], strictness: str
    ) -> List[RawDetection]:
        """Filter detections based on selected policy scope."""
        policy = (strictness or "gdpr-hipaa").lower()
        if policy == "secrets-only":
            return [d for d in detections if d.category == "Developer Credentials" or d.risk == "High"]
        elif policy == "standard":
            # Exclude low-risk organizations or generic dates
            return [d for d in detections if d.type_ not in {"ORGANIZATION", "DATE_TIME"}]
        # Default gdpr-hipaa: keep all identified sensitive categories
        return detections

    def _apply_protection_mode(
        self,
        text: str,
        detections: List[RawDetection],
        task: str,
        privacy_mode: str,
    ) -> Tuple[List[Finding], str]:
        """Generate consistent placeholders and transform text based on mode."""
        if not detections:
            return [], text

        # Maps (type, normalized_value) -> consistent placeholder string
        placeholder_registry: Dict[Tuple[str, str], str] = {}
        # Counter per entity type: e.g. {"PERSON": 2, "EMAIL_ADDRESS": 1}
        type_counters: Dict[str, int] = {}
        # Synthetic index counter per type
        synthetic_counters: Dict[str, int] = {}

        # First pass: determine action, ambiguity, and replacement for each detection
        finding_plans = []
        for idx, det in enumerate(detections, start=1):
            entity_type = det.type_
            raw_snippet = det.text
            norm_key = (entity_type, raw_snippet.strip().lower())

            # Determine placeholder tag [TYPE_1]
            if norm_key not in placeholder_registry:
                current_count = type_counters.get(entity_type, 0) + 1
                type_counters[entity_type] = current_count
                placeholder_registry[norm_key] = f"[{entity_type}_{current_count}]"

            token_placeholder = placeholder_registry[norm_key]

            # Determine mode-specific behavior
            action, replacement, is_ambiguous, ambiguity_reason = self._resolve_mode_action(
                detection=det,
                token_placeholder=token_placeholder,
                task=task,
                privacy_mode=privacy_mode,
                synthetic_counters=synthetic_counters,
            )

            finding = Finding(
                id=idx,
                type=det.type_,
                category=det.category,
                originalSnippet=raw_snippet,
                sanitizedSnippet=replacement,
                start=det.start,
                end=det.end,
                confidence=round(det.confidence, 4),
                risk=det.risk,
                action=action,
                source=det.source,
                explanation=det.explanation,
                is_ambiguous=is_ambiguous,
                ambiguity_reason=ambiguity_reason,
            )
            finding_plans.append((det.start, det.end, replacement, finding))

        # Reconstruct text by replacing spans in reverse order to preserve offsets
        # Sort plans by start offset ascending
        finding_plans.sort(key=lambda x: x[0])

        if privacy_mode == "user-approved":
            # In user-approved mode, we do NOT commit destructive edits
            # We return proposed redactions for review without claiming approval
            # The text can retain inline review tags or original text
            protected_text = self._build_user_approved_preview(text, finding_plans)
        else:
            protected_text = self._build_protected_text(text, finding_plans)

        findings = [plan[3] for plan in finding_plans]
        return findings, protected_text

    def _resolve_mode_action(
        self,
        detection: RawDetection,
        token_placeholder: str,
        task: str,
        privacy_mode: str,
        synthetic_counters: Dict[str, int],
    ) -> Tuple[str, str, bool, Optional[str]]:
        """Determine specific action, replacement token, and task-relevance reasoning."""
        task_lower = task.lower()
        is_ambiguous = False
        ambiguity_reason: Optional[str] = None

        # Mode: 'strict' or 'redaction'
        if privacy_mode in ("strict", "redaction"):
            return "Redacted", token_placeholder, False, None

        # Mode: 'user-approved'
        if privacy_mode == "user-approved":
            return (
                "Proposed Redaction",
                f"[PROPOSED: {token_placeholder}]",
                False,
                "Proposed sensitive entity candidate awaiting explicit user confirmation.",
            )

        # Mode: 'synthetic'
        if privacy_mode == "synthetic":
            pool = SYNTHETIC_POOLS.get(detection.type_, ["ANONYMIZED_VALUE"])
            synth_idx = synthetic_counters.get(detection.type_, 0)
            replacement = pool[synth_idx % len(pool)]
            synthetic_counters[detection.type_] = synth_idx + 1
            return "Substituted", replacement, False, None

        # Mode: 'tokenized'
        if privacy_mode == "tokenized":
            return "Masked", token_placeholder, False, None

        # Mode: 'task-aware'
        if privacy_mode == "task-aware":
            return self._evaluate_task_awareness(detection, token_placeholder, task_lower)

        # Fallback default
        return "Redacted", token_placeholder, False, None

    def _evaluate_task_awareness(
        self,
        detection: RawDetection,
        token_placeholder: str,
        task_lower: str,
    ) -> Tuple[str, str, bool, Optional[str]]:
        """Documented explicit task-relevance rules.

        Flags ambiguous decisions instead of claiming perfect contextual comprehension.
        """
        # Rule 1: High-entropy developer credentials and passwords are NEVER justified in prompt text
        if detection.category == "Developer Credentials":
            return (
                "Redacted",
                token_placeholder,
                False,
                "Developer credentials and private keys are never task-justified in prompt text.",
            )

        # Rule 2: Government IDs and Financial IDs are strictly protected
        if detection.category in ("Government ID", "Financial Data"):
            return (
                "Redacted",
                token_placeholder,
                False,
                f"{detection.category} redacted under data minimization policy; prohibited in LLM prompts.",
            )

        # Rule 3: Customer Support / Communication audit task
        if any(keyword in task_lower for keyword in ("support", "helpdesk", "customer", "contact", "ticket")):
            if detection.type_ in ("EMAIL_ADDRESS", "PHONE_NUMBER"):
                # Ambiguous: Contact identifier may be the subject of customer inquiry
                return (
                    "Redacted",
                    token_placeholder,
                    True,
                    "Ambiguous task relevance: Contact item is part of customer inquiry; tokenized placeholder used to preserve semantic reference while masking raw PII.",
                )
            if detection.type_ == "PERSON":
                return (
                    "Redacted",
                    token_placeholder,
                    True,
                    "Ambiguous: Customer name may be needed for personalization, but redacted for privacy minimization.",
                )

        # Rule 4: DevOps / Server / Infrastructure task
        if any(keyword in task_lower for keyword in ("devops", "config", "server", "infra", "deploy")):
            if detection.type_ == "IP_ADDRESS":
                return (
                    "Redacted",
                    token_placeholder,
                    True,
                    "Ambiguous: IP address might be internal test infrastructure or production node; redacted to prevent internal topology leakage.",
                )

        # Rule 5: Healthcare / Medical task
        if any(keyword in task_lower for keyword in ("health", "medical", "hipaa", "patient", "clinical")):
            if detection.category == "Protected Health Information (PHI)":
                return (
                    "Redacted",
                    token_placeholder,
                    False,
                    "PHI entity redacted under HIPAA Safe Harbor de-identification rules.",
                )
            if detection.type_ == "ORGANIZATION":
                return (
                    "Redacted",
                    token_placeholder,
                    True,
                    "Ambiguous: Healthcare facility name may provide clinical context, but flagged for institutional confidentiality.",
                )

        # Default fallback for task-aware: Conservative minimization
        return (
            "Redacted",
            token_placeholder,
            True,
            f"Ambiguous: Task '{task_lower[:40]}' has no explicit policy exemption for '{detection.type_}'; redacted under minimization default.",
        )

    def _build_protected_text(self, original_text: str, plans: List[Tuple[int, int, str, Finding]]) -> str:
        """Construct new string with replaced spans using reverse offset substitution."""
        # Sort plans in reverse order so character offsets remain valid throughout
        sorted_plans = sorted(plans, key=lambda x: x[0], reverse=True)
        chars = list(original_text)

        for start, end, replacement, _ in sorted_plans:
            chars[start:end] = list(replacement)

        return "".join(chars)

    def _build_user_approved_preview(
        self, original_text: str, plans: List[Tuple[int, int, str, Finding]]
    ) -> str:
        """In user-approved mode, generate a non-destructive preview with proposed markers."""
        sorted_plans = sorted(plans, key=lambda x: x[0], reverse=True)
        chars = list(original_text)

        for start, end, _, finding in sorted_plans:
            marker = f"[PROPOSED_REDACT: {finding.type}_{finding.id}]"
            chars[start:end] = list(marker)

        return "".join(chars)

    def _verify_protected_text(
        self,
        protected_text: str,
        original_detections: List[Finding],
        privacy_mode: str,
    ) -> VerificationResult:
        """Run secondary detection pass over protected output to verify risk elimination."""
        if privacy_mode == "user-approved":
            return VerificationResult(
                passed=True,
                residual_findings_count=0,
                residual_risks=["User-approved mode: Output text is pending human review and approval."],
                second_pass_findings=[],
                explanation="Second pass bypassed for user-approved review mode; pending user confirmation.",
            )

        # Run detector over protected text
        second_pass_raw = self.detector.detect_all(protected_text)

        # Filter out known safe placeholders like [PERSON_1], [EMAIL_1], etc.
        residual_candidates: List[Dict[str, Any]] = []
        for det in second_pass_raw:
            # Check if snippet matches our generated placeholders (with or without brackets)
            cleaned = det.text.strip("[] \t")
            if re.fullmatch(r"[A-Z_]+_\d+", cleaned) or re.fullmatch(r"PROPOSED.*", cleaned):
                continue
            # Also check if the detected span is enclosed within bracket bounds in protected_text
            if det.start > 0 and det.end < len(protected_text):
                surrounding = protected_text[max(0, det.start - 1) : min(len(protected_text), det.end + 1)]
                if surrounding.startswith("[") and surrounding.endswith("]"):
                    continue
            residual_candidates.append(det.to_dict())

        passed = len(residual_candidates) == 0
        residual_risks: List[str] = []

        if not passed:
            residual_risks.append(
                f"Secondary audit detected {len(residual_candidates)} potential residual sensitive entity span(s) in protected output."
            )
        else:
            # Documented residual risks inherent to any NLP redaction
            residual_risks.append(
                "Quasi-identifier risk: Surrounding narrative context or unique phrasing may allow probabilistic re-identification."
            )
            residual_risks.append(
                "Model limitation: Pretrained models may miss novel or non-standard obfuscated patterns."
            )

        explanation = (
            "Verification passed: No unmitigated sensitive identifiers were detected in the secondary audit pass."
            if passed
            else f"Verification alert: Secondary audit discovered {len(residual_candidates)} unredacted item(s). Manual review recommended."
        )

        return VerificationResult(
            passed=passed,
            residual_findings_count=len(residual_candidates),
            residual_risks=residual_risks,
            second_pass_findings=residual_candidates,
            explanation=explanation,
        )

    def _compute_privacy_score(self, findings: List[Finding], verification: VerificationResult) -> float:
        """Calculate dynamic privacy assurance score (0 - 100)."""
        if not findings:
            return 100.0

        high_count = sum(1 for f in findings if f.risk == "High")
        med_count = sum(1 for f in findings if f.risk == "Medium")
        low_count = sum(1 for f in findings if f.risk == "Low")

        # Base penalty before protection
        raw_penalty = (high_count * 20) + (med_count * 10) + (low_count * 4)

        # Protection recovery credit: successfully redacting entities mitigates risk
        mitigation_ratio = 0.90 if verification.passed else 0.50
        mitigated_penalty = raw_penalty * (1.0 - mitigation_ratio)

        score = max(55.0, min(100.0, 100.0 - mitigated_penalty))
        return round(score, 1)

    def _generate_summary(
        self,
        findings: List[Finding],
        mode: str,
        task: str,
        verification: VerificationResult,
    ) -> str:
        """Generate concise, factual summary of the privacy operation."""
        if not findings:
            return "Clean scan: No sensitive PII, credentials, or confidential entities were identified."

        cats = sorted(list({f.category for f in findings}))
        cat_str = ", ".join(cats)

        if mode == "user-approved":
            return (
                f"Proposed {len(findings)} sensitive item{'s' if len(findings) > 1 else ''} "
                f"across {len(cats)} categories ({cat_str}) for user review. No irreversible changes applied."
            )

        ambig_count = sum(1 for f in findings if f.is_ambiguous)
        ambig_suffix = f" ({ambig_count} decision{'s' if ambig_count > 1 else ''} flagged for ambiguity)" if ambig_count > 0 else ""

        return (
            f"Identified and protected {len(findings)} sensitive item{'s' if len(findings) > 1 else ''} "
            f"across {len(cats)} categories ({cat_str}) using '{mode}' mode{ambig_suffix}. "
            f"Verification: {'Passed' if verification.passed else 'Residual risks flagged'}."
        )


# Module singleton instance
privacy_engine = PrivacyEngine()
