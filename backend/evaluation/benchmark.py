"""Synthetic Evaluation & Benchmarking Suite for PrivacyGuard AI.

Evaluates:
1. GLiNER contextual AI model alone
2. Supplementary recognizers (Microsoft Presidio + Deterministic Rules)
3. Combined PrivacyGuard AI Hybrid Engine (Reconciled)

Computes genuine Precision, Recall, F1, and Latency on a curated synthetic dataset.
Zero fabricated numbers.
"""

import time
import json
from typing import List, Dict, Any, Tuple
from app.services.ai_detector import AIDetectorService, RawDetection


# Curated 100% synthetic evaluation dataset with ground-truth entity spans
SYNTHETIC_BENCHMARK_DATASET = [
    {
        "id": "syn-01",
        "description": "Standard contact details & direct identifier",
        "text": "Please reach out to Alexander Wright at alexander.wright@apexdev.io or call (555) 234-5678 regarding the contract.",
        "annotations": [
            {"text": "Alexander Wright", "type": "PERSON", "category": "Contact PII"},
            {"text": "alexander.wright@apexdev.io", "type": "EMAIL_ADDRESS", "category": "Contact PII"},
            {"text": "(555) 234-5678", "type": "PHONE_NUMBER", "category": "Contact PII"},
        ],
    },
    {
        "id": "syn-02",
        "description": "Developer secret key & access credential",
        "text": "Deploy script failed: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE was rejected with auth token sk-prod9876543210fedcba.",
        "annotations": [
            {"text": "AKIAIOSFODNN7EXAMPLE", "type": "AWS_ACCESS_KEY", "category": "Developer Credentials"},
            {"text": "sk-prod9876543210fedcba", "type": "API_KEY", "category": "Developer Credentials"},
        ],
    },
    {
        "id": "syn-03",
        "description": "Protected Health Information (PHI) & clinical diagnosis",
        "text": "Patient Sarah Jenkins was diagnosed with hypertension and prescribed lisinopril at Memorial Hospital.",
        "annotations": [
            {"text": "Sarah Jenkins", "type": "PERSON", "category": "Contact PII"},
            {"text": "hypertension", "type": "MEDICAL_CONDITION", "category": "Protected Health Information (PHI)"},
            {"text": "Memorial Hospital", "type": "ORGANIZATION", "category": "Organization Data"},
        ],
    },
    {
        "id": "syn-04",
        "description": "Government identifier & financial card",
        "text": "Applicant verified identity with SSN 000-12-3456 and debit card ending 4532-0150-1234-5678.",
        "annotations": [
            {"text": "000-12-3456", "type": "SSN", "category": "Government ID"},
            {"text": "4532-0150-1234-5678", "type": "CREDIT_CARD", "category": "Financial Data"},
        ],
    },
    {
        "id": "syn-05",
        "description": "Quasi-identifier linkage triad (Person + Location + Organization)",
        "text": "Chief Architect Elena Rostova led the autonomous systems symposium in Zurich for Helios Robotics.",
        "annotations": [
            {"text": "Elena Rostova", "type": "PERSON", "category": "Contact PII"},
            {"text": "Zurich", "type": "LOCATION", "category": "Location Data"},
            {"text": "Helios Robotics", "type": "ORGANIZATION", "category": "Organization Data"},
        ],
    },
    {
        "id": "syn-06",
        "description": "Clean technical text with zero sensitive entities (False Positive Control)",
        "text": "The distributed ledger consensus protocol achieved sub-second latency across twenty validator nodes without partition.",
        "annotations": [],
    },
]


def match_span(pred_text: str, true_text: str) -> bool:
    """Checks if predicted string matches true annotation (exact or substring)."""
    p = pred_text.strip().lower()
    t = true_text.strip().lower()
    return p == t or p in t or t in p


def evaluate_engine_mode(detector: AIDetectorService, mode: str) -> Dict[str, Any]:
    """Evaluates a specific engine configuration over the synthetic benchmark dataset."""
    total_tp = 0
    total_fp = 0
    total_fn = 0
    latencies_ms: List[float] = []
    missed_detections: List[Dict[str, Any]] = []
    false_positives: List[Dict[str, Any]] = []

    for item in SYNTHETIC_BENCHMARK_DATASET:
        text = item["text"]
        true_ann = item["annotations"]

        # Run inference based on mode
        t0 = time.perf_counter()
        if mode == "gliner_only":
            raw = detector.detect_gliner(text) if detector.model_loaded else []
            preds = detector.reconcile_spans(text, raw)
        elif mode == "supplementary_only":
            rule_preds = detector.detect_secrets(text)
            presidio_preds = detector.detect_presidio(text) if detector.presidio_loaded else []
            preds = detector.reconcile_spans(text, rule_preds + presidio_preds)
        elif mode == "combined_hybrid":
            preds = detector.detect_all(text)
        else:
            raise ValueError(f"Unknown mode: {mode}")
        t1 = time.perf_counter()
        latencies_ms.append((t1 - t0) * 1000.0)

        # Match predictions with annotations
        matched_true = set()
        matched_preds = set()

        for p_idx, p in enumerate(preds):
            matched = False
            for t_idx, t in enumerate(true_ann):
                if t_idx not in matched_true and match_span(p.text, t["text"]):
                    matched_true.add(t_idx)
                    matched_preds.add(p_idx)
                    total_tp += 1
                    matched = True
                    break
            if not matched:
                total_fp += 1
                false_positives.append({
                    "sample_id": item["id"],
                    "detected_text": p.text,
                    "type": p.type_,
                    "source": p.source,
                    "confidence": p.confidence,
                })

        for t_idx, t in enumerate(true_ann):
            if t_idx not in matched_true:
                total_fn += 1
                missed_detections.append({
                    "sample_id": item["id"],
                    "true_text": t["text"],
                    "expected_type": t["type"],
                    "category": t["category"],
                })

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    avg_latency = sum(latencies_ms) / len(latencies_ms) if latencies_ms else 0.0

    return {
        "mode": mode,
        "true_positives": total_tp,
        "false_positive_count": total_fp,
        "false_negative_count": total_fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "avg_latency_ms": round(avg_latency, 2),
        "min_latency_ms": round(min(latencies_ms), 2) if latencies_ms else 0.0,
        "max_latency_ms": round(max(latencies_ms), 2) if latencies_ms else 0.0,
        "missed_detections": missed_detections,
        "false_positives": false_positives,
    }


def run_full_benchmark() -> Dict[str, Any]:
    print("=" * 80)
    print("PRIVACYGUARD AI - BENCHMARK & EVALUATION SUITE")
    print("=" * 80)

    t_start = time.perf_counter()
    detector = AIDetectorService()
    detector.load_engines()
    t_load = (time.perf_counter() - t_start) * 1000.0

    print(f"[*] Engine Startup Latency: {t_load:.2f} ms")
    print(f"[*] AI Model Loaded: {detector.model_loaded} ({detector.model_name})")
    print(f"[*] Presidio Loaded: {detector.presidio_loaded}")
    print(f"[*] Compute Device: {detector.device}")
    print("-" * 80)

    modes = ["gliner_only", "supplementary_only", "combined_hybrid"]
    results = {}

    for mode in modes:
        res = evaluate_engine_mode(detector, mode)
        results[mode] = res
        print(f"\nConfiguration: {mode.upper()}")
        print(f"  Precision : {res['precision'] * 100:.1f}% ({res['true_positives']}/{res['true_positives'] + res['false_positive_count']})")
        print(f"  Recall    : {res['recall'] * 100:.1f}% ({res['true_positives']}/{res['true_positives'] + res['false_negative_count']})")
        print(f"  F1 Score  : {res['f1_score'] * 100:.1f}%")
        print(f"  Avg Latency: {res['avg_latency_ms']} ms (min: {res['min_latency_ms']} ms, max: {res['max_latency_ms']} ms)")
        print(f"  False Positives ({len(res['false_positives'])}): {[fp['detected_text'] for fp in res['false_positives']]}")
        print(f"  Missed ({len(res['missed_detections'])}): {[m['true_text'] for m in res['missed_detections']]}")

    report = {
        "engine_startup_ms": round(t_load, 2),
        "model_name": detector.model_name,
        "model_loaded": detector.model_loaded,
        "presidio_loaded": detector.presidio_loaded,
        "device": detector.device,
        "eval_samples_count": len(SYNTHETIC_BENCHMARK_DATASET),
        "total_ground_truth_entities": sum(len(s["annotations"]) for s in SYNTHETIC_BENCHMARK_DATASET),
        "benchmark_results": results,
    }

    with open("evaluation_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print("\n" + "=" * 80)
    print("[+] Benchmark evaluation complete. Report written to evaluation_report.json")
    print("=" * 80)
    return report


if __name__ == "__main__":
    run_full_benchmark()
