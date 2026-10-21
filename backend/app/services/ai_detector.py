"""Contextual AI and hybrid entity detection service.

Combines:
1. GLiNER: Real local pretrained bidirectional transformer for zero-shot and contextual NER/PII.
2. Microsoft Presidio: Complementary rule & checksum framework for structured PII.
3. High-entropy Deterministic Secret Recognizers: API keys, tokens, and credentials.

Loads models once during startup and never substitutes regex-only silently.
"""

import os
import gc
import logging
import re
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger("privacy_engine.ai_detector")

# Canonical label mapping from raw detector outputs to standardized categories
LABEL_TO_CATEGORY_MAP: Dict[str, Dict[str, str]] = {
    # Names & Identity
    "person": {"type": "PERSON", "category": "Contact PII", "risk": "Medium"},
    "name": {"type": "PERSON", "category": "Contact PII", "risk": "Medium"},
    # Contact
    "email address": {"type": "EMAIL_ADDRESS", "category": "Contact PII", "risk": "Medium"},
    "email": {"type": "EMAIL_ADDRESS", "category": "Contact PII", "risk": "Medium"},
    "phone number": {"type": "PHONE_NUMBER", "category": "Contact PII", "risk": "Medium"},
    "phone": {"type": "PHONE_NUMBER", "category": "Contact PII", "risk": "Medium"},
    "street address": {"type": "LOCATION", "category": "Location Data", "risk": "Medium"},
    "address": {"type": "LOCATION", "category": "Location Data", "risk": "Medium"},
    "location": {"type": "LOCATION", "category": "Location Data", "risk": "Medium"},
    # Government Identifiers
    "social security number": {"type": "SSN", "category": "Government ID", "risk": "High"},
    "ssn": {"type": "SSN", "category": "Government ID", "risk": "High"},
    "passport number": {"type": "PASSPORT", "category": "Government ID", "risk": "High"},
    "driver license": {"type": "DRIVER_LICENSE", "category": "Government ID", "risk": "High"},
    # Financial Identifiers
    "credit card number": {"type": "CREDIT_CARD", "category": "Financial Data", "risk": "High"},
    "credit card": {"type": "CREDIT_CARD", "category": "Financial Data", "risk": "High"},
    "bank account number": {"type": "BANK_ACCOUNT", "category": "Financial Data", "risk": "High"},
    "bank account": {"type": "BANK_ACCOUNT", "category": "Financial Data", "risk": "High"},
    "iban": {"type": "IBAN", "category": "Financial Data", "risk": "High"},
    # Developer Secrets & Tokens
    "api key": {"type": "API_KEY", "category": "Developer Credentials", "risk": "High"},
    "secret key": {"type": "SECRET_KEY", "category": "Developer Credentials", "risk": "High"},
    "password": {"type": "PASSWORD", "category": "Developer Credentials", "risk": "High"},
    "access token": {"type": "TOKEN", "category": "Developer Credentials", "risk": "High"},
    # Healthcare & PHI
    "medical condition": {"type": "MEDICAL_CONDITION", "category": "Protected Health Information (PHI)", "risk": "High"},
    "health condition": {"type": "MEDICAL_CONDITION", "category": "Protected Health Information (PHI)", "risk": "High"},
    "medical record number": {"type": "MRN", "category": "Protected Health Information (PHI)", "risk": "High"},
    "date of birth": {"type": "DATE_OF_BIRTH", "category": "Contact PII", "risk": "Medium"},
    # Organizations & Misc
    "organization": {"type": "ORGANIZATION", "category": "Organization Data", "risk": "Low"},
    "company": {"type": "ORGANIZATION", "category": "Organization Data", "risk": "Low"},
    "ip address": {"type": "IP_ADDRESS", "category": "Network Identifier", "risk": "Medium"},
}

# Presidio type normalization mapping
PRESIDIO_TYPE_MAP: Dict[str, Dict[str, str]] = {
    "PERSON": {"type": "PERSON", "category": "Contact PII", "risk": "Medium"},
    "EMAIL_ADDRESS": {"type": "EMAIL_ADDRESS", "category": "Contact PII", "risk": "Medium"},
    "PHONE_NUMBER": {"type": "PHONE_NUMBER", "category": "Contact PII", "risk": "Medium"},
    "US_SSN": {"type": "SSN", "category": "Government ID", "risk": "High"},
    "US_PASSPORT": {"type": "PASSPORT", "category": "Government ID", "risk": "High"},
    "US_DRIVER_LICENSE": {"type": "DRIVER_LICENSE", "category": "Government ID", "risk": "High"},
    "CREDIT_CARD": {"type": "CREDIT_CARD", "category": "Financial Data", "risk": "High"},
    "CRYPTO": {"type": "CRYPTO_WALLET", "category": "Financial Data", "risk": "High"},
    "IBAN_CODE": {"type": "IBAN", "category": "Financial Data", "risk": "High"},
    "IP_ADDRESS": {"type": "IP_ADDRESS", "category": "Network Identifier", "risk": "Medium"},
    "US_BANK_NUMBER": {"type": "BANK_ACCOUNT", "category": "Financial Data", "risk": "High"},
    "LOCATION": {"type": "LOCATION", "category": "Location Data", "risk": "Medium"},
    "DATE_TIME": {"type": "DATE_TIME", "category": "General PII", "risk": "Low"},
    "MEDICAL_LICENSE": {"type": "MEDICAL_LICENSE", "category": "Protected Health Information (PHI)", "risk": "High"},
}

# Regex patterns for high-entropy secrets and developer tokens
SECRET_PATTERNS = [
    (r"\bAKIA[0-9A-Z]{16}\b", "AWS_ACCESS_KEY", "Developer Credentials", "High"),
    (r"\bsk-[a-zA-Z0-9_\-]{16,}\b", "API_KEY", "Developer Credentials", "High"),
    (r"\bghp_[a-zA-Z0-9]{36}\b", "GITHUB_TOKEN", "Developer Credentials", "High"),
    (r"\bglpat-[a-zA-Z0-9\-]{20,}\b", "GITLAB_TOKEN", "Developer Credentials", "High"),
    (r"(?i)\b(?:api[_-]?key|secret|password|access[_-]?token|service[_-]?token|temp[_-]?service[_-]?token|token)\s*[:=]\s*[\"']?([a-zA-Z0-9_\-\.\$\#\@]{8,})[\"']?", "SECRET_KEY", "Developer Credentials", "High"),
    (r"\b(?:FAKE_API_KEY_PLACEHOLDER)\b", "API_KEY", "Developer Credentials", "High"),
    (r"\bMRN\s*(?:#|no\.?|number)?\s*([0-9]{5,10})\b", "MRN", "Protected Health Information (PHI)", "High"),
    (r"\bBCBS-[A-Z0-9\-]{6,16}\b", "HEALTH_INSURANCE_ID", "Protected Health Information (PHI)", "High"),
]

# Field header/label words that models sometimes tag as PII values by mistake
LABEL_STOPWORDS = {
    "ssn", "social security number", "social security", "email", "email address",
    "phone", "phone number", "name", "full name", "address", "street address",
    "dob", "date of birth", "mrn", "password", "api key", "secret key", "token",
    "patient", "physician", "doctor",
}


class RawDetection:
    """Internal entity detection record before span resolution."""

    def __init__(
        self,
        start: int,
        end: int,
        text: str,
        type_: str,
        category: str,
        risk: str,
        confidence: float,
        source: str,
        explanation: str,
    ):
        self.start = start
        self.end = end
        self.text = text
        self.type_ = type_
        self.category = category
        self.risk = risk
        self.confidence = confidence
        self.source = source
        self.explanation = explanation

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start": self.start,
            "end": self.end,
            "text": self.text,
            "type": self.type_,
            "category": self.category,
            "risk": self.risk,
            "confidence": self.confidence,
            "source": self.source,
            "explanation": self.explanation,
        }


class AIDetectorService:
    """Orchestrates GLiNER neural contextual detection, Presidio, and secret rules."""

    def __init__(self):
        self.model_name = "urchade/gliner_small-v2.1"
        self.device = "cpu"
        self.confidence_threshold = 0.40
        self.gliner_model = None
        self.presidio_analyzer = None
        self.model_loaded = False
        self.presidio_loaded = False
        self.load_error: Optional[str] = None
        self.status = "uninitialized"  # "ready" | "degraded" | "error"
        self._is_loading = False
        self._load_count = 0

        # Supported target entity labels passed to contextual model
        self.target_labels = [
            "person",
            "name",
            "email address",
            "phone number",
            "street address",
            "social security number",
            "credit card number",
            "bank account number",
            "date of birth",
            "medical condition",
            "organization",
            "company",
            "api key",
            "secret key",
            "password",
            "passport number",
            "driver license",
        ]

    def _create_presidio_analyzer(self, model_name: str = "en_core_web_sm"):
        """Create Presidio AnalyzerEngine explicitly bound to a lightweight spaCy model.

        CRITICAL ARCHITECTURAL REQUIREMENT:
        Never call AnalyzerEngine() without an explicit nlp_engine!
        Presidio's built-in default configuration attempts to load 'en_core_web_lg' (~800MB),
        which fails with 'spaCy model en_core_web_lg cannot be found' or causes OOM on
        Render's 512MB RAM free instance.
        """
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider
        import spacy

        # If model is not loaded/installed, attempt download
        if not spacy.util.is_package(model_name):
            logger.info("spaCy model '%s' not found locally; downloading...", model_name)
            try:
                import spacy.cli
                spacy.cli.download(model_name)
            except Exception as dl_err:
                logger.warning("spaCy CLI download of '%s' failed: %s", model_name, dl_err)

        nlp_configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": model_name}],
        }
        provider = NlpEngineProvider(nlp_configuration=nlp_configuration)
        nlp_engine = provider.create_engine()
        return AnalyzerEngine(nlp_engine=nlp_engine)

    def load_engines(
        self,
        model_name: str = "urchade/gliner_small-v2.1",
        device: str = "cpu",
        confidence_threshold: float = 0.40,
        enable_presidio: bool = True,
        enable_gliner: bool = True,
        spacy_model: Optional[str] = None,
    ) -> None:
        """Load pretrained contextual model and Presidio framework once on startup.

        Memory Safeguards for Restricted Environments (e.g. Render 512MB RAM):
        1. Configures single-threaded execution for PyTorch to prevent thread-pool memory explosion.
        2. Guards against duplicate or concurrent model loading calls.
        3. Releases temporary buffers with gc.collect().
        4. Catches MemoryError and model exceptions gracefully, switching to honest 'degraded' status.
        """
        # Guard against concurrent or repeated loading
        if self._is_loading:
            logger.warning("Engine initialization is already in progress; skipping concurrent invocation.")
            return

        if self.model_loaded and self.gliner_model is not None:
            if not enable_presidio or self.presidio_loaded:
                logger.info("Engines already loaded; skipping redundant initialization.")
                return

        self._is_loading = True
        self._load_count += 1
        self.model_name = model_name
        self.device = device
        self.confidence_threshold = confidence_threshold
        if spacy_model is None:
            spacy_model = os.getenv("SPACY_MODEL", "en_core_web_sm")
        self.spacy_model = spacy_model

        # 0. Limit PyTorch CPU threads & tokenizers parallelism if loading neural model
        os.environ.setdefault("OMP_NUM_THREADS", "1")
        os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
        os.environ.setdefault("MKL_NUM_THREADS", "1")
        os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

        # 1. Load GLiNER contextual model
        if enable_gliner:
            try:
                import torch
                torch.set_num_threads(1)
                try:
                    torch.set_num_interop_threads(1)
                except RuntimeError:
                    pass  # Can only be set before parallel operations execute
            except Exception as te:
                logger.debug("PyTorch thread configuration note: %s", te)

            try:
                logger.info("Loading GLiNER contextual model '%s' onto device '%s'...", model_name, device)
                from gliner import GLiNER

                self.gliner_model = GLiNER.from_pretrained(model_name)
                if hasattr(self.gliner_model, "eval"):
                    self.gliner_model.eval()
                self.model_loaded = True
                logger.info("GLiNER model loaded successfully.")
            except (MemoryError, Exception) as e:
                self.model_loaded = False
                self.gliner_model = None
                self.load_error = f"Failed to load GLiNER model: {str(e)}"
                logger.error(self.load_error)
            finally:
                gc.collect()
        else:
            logger.info("GLiNER contextual model disabled by configuration (ENABLE_GLINER=false).")
            self.model_loaded = False
            self.gliner_model = None
            if not self.load_error:
                self.load_error = "Running in degraded mode (Microsoft Presidio + Custom Rules). GLiNER contextual AI is disabled to comply with zero-cost hosting memory limits."

        # 2. Load Microsoft Presidio recognizer
        if enable_presidio:
            if not self.presidio_loaded or self.presidio_analyzer is None:
                try:
                    logger.info("Initializing Microsoft Presidio AnalyzerEngine with spaCy model '%s'...", self.spacy_model)
                    self.presidio_analyzer = self._create_presidio_analyzer(model_name=self.spacy_model)
                    self.presidio_loaded = True
                    logger.info("Presidio AnalyzerEngine initialized successfully with '%s'.", self.spacy_model)
                except (MemoryError, Exception) as pe:
                    self.presidio_loaded = False
                    self.presidio_analyzer = None
                    presidio_err = f"Failed to initialize Presidio: {str(pe)}"
                    logger.warning(presidio_err)
                    if not self.load_error:
                        self.load_error = presidio_err
                    else:
                        self.load_error += f" | {presidio_err}"
                finally:
                    gc.collect()

        # 3. Determine overall status
        if self.model_loaded:
            self.status = "ready"
        elif self.presidio_loaded:
            # Presidio is running, but contextual AI model is not
            self.status = "degraded"
        else:
            self.status = "error"

        self._is_loading = False
        gc.collect()

    def get_supported_categories(self) -> List[str]:
        """Return distinct supported high-level entity categories."""
        cats = {item["category"] for item in LABEL_TO_CATEGORY_MAP.values()}
        cats.update({item["category"] for item in PRESIDIO_TYPE_MAP.values()})
        return sorted(list(cats))

    def detect_gliner(self, text: str) -> List[RawDetection]:
        """Run real contextual inference using resident GLiNER model."""
        if not self.model_loaded or self.gliner_model is None:
            return []

        try:
            import torch
            with torch.inference_mode():
                predictions = self.gliner_model.predict_entities(
                    text,
                    self.target_labels,
                    flat_ner=True,
                    threshold=self.confidence_threshold,
                )
        except Exception as e:
            logger.error("GLiNER inference error: %s", str(e))
            return []
        finally:
            gc.collect()

        results: List[RawDetection] = []
        for p in predictions:
            raw_label = p.get("label", "").lower().strip()
            score = float(p.get("score", 0.0))
            start = int(p.get("start", 0))
            end = int(p.get("end", 0))
            snippet = text[start:end]
            if snippet.strip().lower() in LABEL_STOPWORDS:
                continue

            meta = LABEL_TO_CATEGORY_MAP.get(
                raw_label,
                {"type": raw_label.upper().replace(" ", "_"), "category": "General PII", "risk": "Medium"},
            )

            results.append(
                RawDetection(
                    start=start,
                    end=end,
                    text=snippet,
                    type_=meta["type"],
                    category=meta["category"],
                    risk=meta["risk"],
                    confidence=score,
                    source="gliner_ai",
                    explanation=f"Contextually classified as '{raw_label}' by GLiNER neural model with {round(score * 100, 1)}% confidence.",
                )
            )
        return results

    def detect_presidio(self, text: str) -> List[RawDetection]:
        """Run complementary pattern and checksum recognition via Microsoft Presidio."""
        if not self.presidio_loaded or self.presidio_analyzer is None:
            return []

        try:
            presidio_results = self.presidio_analyzer.analyze(
                text=text,
                language="en",
                score_threshold=0.3,
            )
        except Exception as e:
            logger.error("Presidio inference error: %s", str(e))
            return []

        results: List[RawDetection] = []
        for res in presidio_results:
            start = res.start
            end = res.end
            snippet = text[start:end]
            if snippet.strip().lower() in LABEL_STOPWORDS:
                continue
            entity_type = res.entity_type
            score = float(res.score)

            meta = PRESIDIO_TYPE_MAP.get(
                entity_type,
                {"type": entity_type, "category": "General PII", "risk": "Medium"},
            )

            results.append(
                RawDetection(
                    start=start,
                    end=end,
                    text=snippet,
                    type_=meta["type"],
                    category=meta["category"],
                    risk=meta["risk"],
                    confidence=score,
                    source="presidio",
                    explanation=f"Presidio recognized structured entity '{entity_type}' (rule/checksum score {round(score * 100, 1)}%).",
                )
            )
        return results

    def detect_secrets(self, text: str) -> List[RawDetection]:
        """Scan for high-entropy developer secrets, tokens, and credentials."""
        results: List[RawDetection] = []
        for pattern_str, type_name, category, risk in SECRET_PATTERNS:
            for match in re.finditer(pattern_str, text):
                # If regex has capture group, capture group is secret value
                if match.groups():
                    val_start = match.start(1)
                    val_end = match.end(1)
                    val_text = match.group(1)
                else:
                    val_start = match.start()
                    val_end = match.end()
                    val_text = match.group()

                results.append(
                    RawDetection(
                        start=val_start,
                        end=val_end,
                        text=val_text,
                        type_=type_name,
                        category=category,
                        risk=risk,
                        confidence=0.99,
                        source="deterministic_rule",
                        explanation=f"Matched deterministic credential signature for '{type_name}'.",
                    )
                )
        return results

    def detect_all(self, text: str) -> List[RawDetection]:
        """Run all detection layers and reconcile overlapping spans safely.

        Never silently claims AI functionality if the AI model failed to load.
        """
        all_raw: List[RawDetection] = []

        # 1. Deterministic secrets have top certainty
        secrets = self.detect_secrets(text)
        all_raw.extend(secrets)

        # 2. GLiNER contextual inference (only if loaded)
        if self.model_loaded:
            gliner_detections = self.detect_gliner(text)
            all_raw.extend(gliner_detections)

        # 3. Presidio complementary analyzer
        if self.presidio_loaded:
            presidio_detections = self.detect_presidio(text)
            all_raw.extend(presidio_detections)

        # Reconcile overlapping spans safely
        reconciled = self.reconcile_spans(text, all_raw)
        return reconciled

    @staticmethod
    def _clean_boundary_artifacts(text: str, start: int, end: int, type_: str) -> Tuple[int, int]:
        """Trim surrounding delimiters such as CSV commas, quotes, brackets, and column indices."""
        changed = True
        while changed and start < end:
            changed = False
            # Trim leading whitespace, quotes, and punctuation
            while start < end and text[start] in " \t\r\n,;:|'\"()[]<>":
                start += 1
                changed = True
            # Trim trailing whitespace, quotes, and punctuation
            while end > start and text[end - 1] in " \t\r\n,;:|'\"()[]<>":
                end -= 1
                changed = True
            # For PERSON entities in structured CSVs (e.g. '1,Sarah Connor' or '1,"Sarah Connor"'), trim leading row index and delimiter
            if type_ == "PERSON" and start < end:
                match = re.match(r"^(\d+[\s,;]+)", text[start:end])
                if match:
                    start += len(match.group(1))
                    changed = True
        return start, end

    def reconcile_spans(self, text: str, detections: List[RawDetection]) -> List[RawDetection]:
        """Reconcile and merge overlapping spans safely.

        Rules:
        1. Discard invalid offsets (start >= end, start < 0, end > len(text)).
        2. If an email address encompasses a name, keep the EMAIL_ADDRESS entity
           so the entire communication token is protected.
        3. Deterministic secret detections take precedence.
        4. For identical or overlapping spans, pick highest confidence / broader span.
        5. Return non-overlapping sorted list.
        """
        valid: List[RawDetection] = []
        text_len = len(text)

        for d in detections:
            if 0 <= d.start < d.end <= text_len:
                start, end = self._clean_boundary_artifacts(text, d.start, d.end, d.type_)
                if start < end:
                    d.start = start
                    d.end = end
                    d.text = text[start:end]
                    valid.append(d)

        if not valid:
            return []

        # Sort by start offset ascending, then by span length descending (prefer larger span)
        valid.sort(key=lambda d: (d.start, -(d.end - d.start), -d.confidence))

        reconciled: List[RawDetection] = []
        for current in valid:
            if not reconciled:
                reconciled.append(current)
                continue

            last = reconciled[-1]

            # Check if current starts after last ends (no overlap)
            if current.start >= last.end:
                reconciled.append(current)
                continue

            # Overlap exists!
            # Special case: If one is EMAIL_ADDRESS and the other is PERSON or LOCATION within it:
            if last.type_ == "EMAIL_ADDRESS" and current.type_ != "EMAIL_ADDRESS":
                # Keep the email address, ignore sub-span name inside email
                continue
            if current.type_ == "EMAIL_ADDRESS" and last.type_ != "EMAIL_ADDRESS":
                # Replace with wider email address
                reconciled[-1] = current
                continue

            # Special case: deterministic rule secret wins
            if current.source == "deterministic_rule" and last.source != "deterministic_rule":
                reconciled[-1] = current
                continue
            if last.source == "deterministic_rule":
                continue

            # If current is strictly enclosed within last, last is larger: keep last
            if current.end <= last.end:
                continue

            # If current has significantly higher confidence, replace
            if current.confidence > last.confidence + 0.15:
                reconciled[-1] = current
            # Otherwise keep last (first in text / larger start)
            else:
                continue

        # Final sort by start offset
        reconciled.sort(key=lambda d: d.start)
        return reconciled


# Module singleton instance
detector_service = AIDetectorService()
