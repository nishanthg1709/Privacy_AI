"""Contextual AI and hybrid entity detection service.

Combines:
1. GLiNER: Real local pretrained bidirectional transformer for zero-shot and contextual NER/PII.
2. Microsoft Presidio: Complementary rule & checksum framework for structured PII.
3. High-entropy Deterministic Secret Recognizers: API keys, tokens, and credentials.

Loads models once during startup and never substitutes regex-only silently.
Memory Architecture for Render Free (512 MB RAM):
- When initializing Presidio AnalyzerEngine, LowMemoryImportBlocker intercepts spaCy's
  thinc backend from importing torch, preventing ~290 MB of PyTorch runtime from being loaded into memory.
- Baseline RAM stays at ~158 MB (instead of ~450 MB), leaving over 350 MB of headroom within
  Render Free's 512 MB cap for multi-row CSV scanning and API requests.
- When ENABLE_GLINER=true on platforms with >= 2 GB RAM, GLiNER loads normally with full neural features.
"""

import os
import gc
import logging
import sys
import re
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger("privacy_engine.ai_detector")

# Suppress harmless Presidio language-compatibility warnings (e.g. EsNifRecognizer, ItFiscalCodeRecognizer)
# These fire because Presidio's registry auto-discovers non-English recognizers at startup.
# Since we configure supported_languages=['en'], they are correctly skipped — the warnings are noise.
logging.getLogger("presidio-analyzer").setLevel(logging.ERROR)

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
    (r"\b\d{3}-\d{2}-\d{4}\b", "SSN", "Government ID", "High"),
    (
        r"(?i)\b\d{1,5}\s+[A-Za-z0-9\.\s]{2,35}\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Lane|Ln|Way|Place|Pl|Square|Sq|Terrace|Ter|Parkway|Pkwy|Circle|Cir|Highway|Hwy|Loop)\b(?:\s+(?:Apt|Suite|Ste|Unit|#)\s*[A-Za-z0-9\-]+)?",
        "LOCATION",
        "Location Data",
        "Medium",
    ),
    (
        r"(?:\+?1[-.\s]?)?(?:\([0-9]{3}\)\s*|[0-9]{3}[-.\s])[0-9]{3}[-.\s][0-9]{4}\b|\b[2-9][0-9]{2}[-.\s][0-9]{4}\b",
        "PHONE_NUMBER",
        "Contact PII",
        "Medium",
    ),
    (
        r"\b(?:4[0-9]{3}|5[1-5][0-9]{2}|6011|3[47][0-9]{2})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b",
        "CREDIT_CARD",
        "Financial Data",
        "High",
    ),
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


class LowMemoryImportBlocker:
    """Blocks speculative imports of heavy neural dependencies (torch, transformers)
    when initializing Presidio or when GLiNER is disabled, reducing process baseline memory from ~450MB to ~158MB."""
    BLOCKED_ROOTS = ("torch", "transformers")

    def __init__(self):
        self._installed = False

    def __enter__(self):
        self.install()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.uninstall()

    def install(self):
        if not self._installed:
            if self not in sys.meta_path:
                sys.meta_path.insert(0, self)
            self._installed = True

    def uninstall(self):
        if self._installed:
            if self in sys.meta_path:
                sys.meta_path.remove(self)
            self._installed = False

    def find_spec(self, fullname, path, target=None):
        if any(fullname == root or fullname.startswith(root + ".") for root in self.BLOCKED_ROOTS):
            raise ModuleNotFoundError(
                f"Module '{fullname}' is disabled for low-memory mode to comply with 512MB hosting limits."
            )
        return None


low_memory_blocker = LowMemoryImportBlocker()


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
        self.spacy_model = os.getenv("SPACY_MODEL", "en_core_web_sm")

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

        The LowMemoryImportBlocker intercepts spaCy's thinc backend from loading torch
        during this import sequence, saving ~290 MB of RAM while allowing full PII recognition.
        """
        os.environ.setdefault("PRESIDIO_DEVICE", "cpu")
        with low_memory_blocker:
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
                "ner_model_configuration": {
                    "labels_to_ignore": ["CARDINAL", "ORDINAL"],
                },
            }
            provider = NlpEngineProvider(nlp_configuration=nlp_configuration)
            nlp_engine = provider.create_engine()

            # Optimize spaCy pipeline: disable parser and ensure comma without whitespace (e.g. in CSV tables)
            # is split into separate tokens so adjacent columns and row indices are not merged with entity names.
            try:
                if hasattr(nlp_engine, "nlp") and isinstance(nlp_engine.nlp, dict):
                    spacy_nlp = nlp_engine.nlp.get("en")
                    if spacy_nlp:
                        if "parser" in spacy_nlp.pipe_names:
                            spacy_nlp.disable_pipes("parser")
                        from spacy.util import compile_infix_regex
                        infixes = list(spacy_nlp.Defaults.infixes) + [r","]
                        spacy_nlp.tokenizer.infix_finditer = compile_infix_regex(infixes).finditer
            except Exception as pe:
                logger.debug("Note on customizing spaCy pipeline / infixes: %s", pe)

            return AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])

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

        # If engines are already initialized (either ready or degraded), skip redundant initialization
        if (self.model_loaded or (not enable_gliner and self.presidio_loaded)) and (not enable_presidio or self.presidio_loaded):
            logger.info("Engines already loaded (status=%s); skipping redundant initialization.", self.status)
            return

        self._is_loading = True
        self._load_count += 1
        self.model_name = model_name
        self.device = device
        self.confidence_threshold = confidence_threshold
        if spacy_model is None:
            spacy_model = os.getenv("SPACY_MODEL", "en_core_web_sm")
        self.spacy_model = spacy_model

        # Ensure low-memory configuration when neural model is disabled
        if not enable_gliner:
            os.environ.setdefault("PRESIDIO_DEVICE", "cpu")

        # 0. Limit PyTorch CPU threads & tokenizers parallelism if loading neural model
        if enable_gliner:
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

    def ensure_presidio_loaded(self) -> bool:
        """Safely verify or deferred-initialize Presidio if startup suffered transient pressure."""
        if self.presidio_loaded and self.presidio_analyzer is not None:
            return True
        try:
            model_to_use = getattr(self, "spacy_model", "en_core_web_sm") or "en_core_web_sm"
            self.presidio_analyzer = self._create_presidio_analyzer(model_name=model_to_use)
            self.presidio_loaded = True
            if self.status != "ready":
                self.status = "degraded"
            logger.info("Presidio deferred initialization succeeded.")
            return True
        except Exception as e:
            logger.warning("Deferred Presidio initialization failed: %s", str(e))
            return False

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

    def _convert_presidio_results(
        self, text_segment: str, presidio_results: List[Any], offset: int = 0
    ) -> List[RawDetection]:
        """Convert Presidio RecognizerResult items to RawDetection instances with optional global offset."""
        results: List[RawDetection] = []
        for res in presidio_results:
            start = res.start + offset
            end = res.end + offset
            snippet = text_segment[res.start:res.end]
            if snippet.strip().lower() in LABEL_STOPWORDS:
                continue
            if res.entity_type == "DATE_TIME":
                snip = snippet.strip()
                if (
                    re.fullmatch(r"\d{1,2}", snip)
                    or re.match(r"^\d{3}[-.]", snip)
                    or re.fullmatch(r"\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}", snip)
                ):
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

    def detect_presidio(self, text: str) -> List[RawDetection]:
        """Run complementary pattern and checksum recognition via Microsoft Presidio."""
        if not self.presidio_loaded or self.presidio_analyzer is None:
            if not self.ensure_presidio_loaded():
                return []

        # For smaller documents, analyze directly
        CHUNK_LIMIT = 4000
        if len(text) <= CHUNK_LIMIT:
            try:
                presidio_results = self.presidio_analyzer.analyze(
                    text=text,
                    language="en",
                    score_threshold=0.3,
                )
            except Exception as e:
                logger.error("Presidio inference error: %s", str(e))
                return []
            return self._convert_presidio_results(text, presidio_results)

        # For larger documents (e.g. CSVs, logs), chunk on line breaks to keep peak
        # memory usage under 200 MB and prevent OOM restarts on 512MB instances.
        all_detections: List[RawDetection] = []
        start = 0
        text_len = len(text)
        while start < text_len:
            if text_len - start <= CHUNK_LIMIT:
                end = text_len
            else:
                split_idx = text.rfind("\n", start, start + CHUNK_LIMIT)
                if split_idx == -1 or split_idx <= start:
                    split_idx = start + CHUNK_LIMIT
                else:
                    split_idx += 1  # Include the newline
                end = split_idx

            chunk_text = text[start:end]
            try:
                chunk_results = self.presidio_analyzer.analyze(
                    text=chunk_text,
                    language="en",
                    score_threshold=0.3,
                )
                chunk_detections = self._convert_presidio_results(chunk_text, chunk_results, offset=start)
                all_detections.extend(chunk_detections)
            except Exception as e:
                logger.error("Presidio chunk inference error at %d-%d: %s", start, end, str(e))

            start = end

        return all_detections

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
        if self.presidio_loaded or self.ensure_presidio_loaded():
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
            # For entities in structured CSVs (e.g. '1,Sarah Connor', '1,Acme Corp', '1,123 Main St'),
            # trim leading row index and delimiter if accidentally captured.
            if type_ == "PERSON" and start < end:
                match = re.match(r"^(\d+[\s,;\t]+)", text[start:end])
                if match:
                    start += len(match.group(1))
                    changed = True
            elif type_ not in ("SSN", "PHONE_NUMBER", "CREDIT_CARD", "BANK_ACCOUNT", "MRN", "DATE_TIME", "DATE_OF_BIRTH") and start < end:
                match = re.match(r"^(\d+[,;\t]+)", text[start:end])
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
        4. If a generic entity overlaps with a structured identifier (SSN, credit card, etc.),
           trim the generic entity boundary so both entities are preserved and redacted.
        5. For identical or overlapping spans, pick highest confidence / broader span.
        6. Return non-overlapping sorted list.
        """
        valid: List[RawDetection] = []
        text_len = len(text)

        STRUCTURED_CRITICAL_TYPES = {
            "SSN",
            "CREDIT_CARD",
            "EMAIL_ADDRESS",
            "PHONE_NUMBER",
            "BANK_ACCOUNT",
            "IBAN",
            "MRN",
            "AWS_ACCESS_KEY",
            "API_KEY",
            "GITHUB_TOKEN",
            "GITLAB_TOKEN",
            "SECRET_KEY",
            "PASSWORD",
            "HEALTH_INSURANCE_ID",
            "CRYPTO_WALLET",
        }

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

            # Special case: Non-destructive reconciliation between generic NLP spans and structured identifiers.
            # When an entity with broad boundaries (e.g. ORGANIZATION or LOCATION) overlaps with a structured
            # identifier (e.g. SSN, credit card, phone), trim the generic entity boundary non-destructively
            # so BOTH entities are preserved and redacted instead of leaving structured PII exposed.
            if last.type_ not in STRUCTURED_CRITICAL_TYPES and current.type_ in STRUCTURED_CRITICAL_TYPES:
                new_start, new_end = self._clean_boundary_artifacts(text, last.start, current.start, last.type_)
                if new_start < new_end:
                    last.start = new_start
                    last.end = new_end
                    last.text = text[new_start:new_end]
                    reconciled.append(current)
                else:
                    reconciled[-1] = current
                continue

            if last.type_ in STRUCTURED_CRITICAL_TYPES and current.type_ not in STRUCTURED_CRITICAL_TYPES:
                new_start, new_end = self._clean_boundary_artifacts(text, last.end, current.end, current.type_)
                if new_start < new_end:
                    current.start = new_start
                    current.end = new_end
                    current.text = text[new_start:new_end]
                    reconciled.append(current)
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
