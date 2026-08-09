"""
CrimeOS AI — Validation Suite v2
=================================
Evaluates the ingestion pipeline against the validation_v2 dataset.
Adds legal-section preservation checks (bns_sections_identified, no_bns_mislabeled_from_ipc)
on top of the standard entity-extraction metrics from run_entity_eval.py.
"""

import os
import sys
import json
import re
import time
from typing import Dict, Any, List
from difflib import SequenceMatcher

# Ensure ai-service root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ingestion.smart_router import process_multimodal_complaint


# ─── Matching Utilities (reused from run_entity_eval.py) ─────────────────────

def normalize_phone(phone: str) -> str:
    return re.sub(r'[^0-9]', '', str(phone))

def fuzzy_match(a: str, b: str, threshold: float = 0.75) -> bool:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio() >= threshold

def name_matches(predicted_name: str, expected: dict) -> bool:
    expected_name = expected.get("name", "")
    alternates = expected.get("name_alternates", [])
    all_names = [expected_name] + alternates
    return any(fuzzy_match(predicted_name, n, 0.70) for n in all_names if n)

def compute_set_prf(predicted: list, expected: list, match_fn) -> Dict[str, float]:
    if not expected and not predicted:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    if not expected:
        return {"precision": 0.0 if predicted else 1.0, "recall": 1.0, "f1": 0.0 if predicted else 1.0}
    if not predicted:
        return {"precision": 1.0, "recall": 0.0, "f1": 0.0}

    matched_expected = set()
    matched_predicted = set()
    for i, p in enumerate(predicted):
        for j, e in enumerate(expected):
            if j not in matched_expected and match_fn(p, e):
                matched_predicted.add(i)
                matched_expected.add(j)
                break

    tp = len(matched_expected)
    precision = tp / len(predicted) if predicted else 0.0
    recall = tp / len(expected) if expected else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


# ─── Per-Field Evaluators ────────────────────────────────────────────────────

def eval_exact_match(predicted: str, expected: str) -> bool:
    return str(predicted).strip().lower() == str(expected).strip().lower()

def eval_crime_sub_type(predicted: str, keywords: list) -> bool:
    pred_lower = predicted.lower() if predicted else ""
    return any(kw.lower() in pred_lower for kw in keywords)

def eval_severity_range(predicted: float, score_range: list) -> bool:
    try:
        return score_range[0] <= float(predicted) <= score_range[1]
    except (TypeError, IndexError, ValueError):
        return False

def eval_persons(predicted_persons: list, expected_persons: list) -> Dict[str, float]:
    def person_match(pred, exp):
        pred_name = pred.get("name", "") if isinstance(pred, dict) else str(pred)
        return name_matches(pred_name, exp)
    return compute_set_prf(predicted_persons, expected_persons, person_match)

def eval_persons_with_role(predicted_persons: list, expected_persons: list) -> Dict[str, float]:
    def person_role_match(pred, exp):
        pred_name = pred.get("name", "") if isinstance(pred, dict) else str(pred)
        pred_role = (pred.get("role", "") if isinstance(pred, dict) else "").lower()
        exp_role = exp.get("role", "").lower()
        return name_matches(pred_name, exp) and pred_role == exp_role
    return compute_set_prf(predicted_persons, expected_persons, person_role_match)

def eval_phone_numbers(predicted: list, expected: list) -> Dict[str, float]:
    def phone_match(pred, exp):
        return normalize_phone(pred) == normalize_phone(exp)
    return compute_set_prf(predicted, expected, phone_match)

def eval_strings_ci(predicted: list, expected: list) -> Dict[str, float]:
    def ci_match(pred, exp):
        return str(pred).strip().lower() == str(exp).strip().lower()
    return compute_set_prf(predicted, expected, ci_match)

def eval_bank_accounts(predicted: list, expected: list) -> Dict[str, float]:
    def bank_match(pred, exp):
        pred_acc = (pred.get("account_number", "") if isinstance(pred, dict) else str(pred)).strip()
        exp_acc = exp.get("account_number", "").strip()
        pred_norm = re.sub(r'[\s\-]', '', pred_acc)
        exp_norm = re.sub(r'[\s\-]', '', exp_acc)
        return pred_norm == exp_norm
    return compute_set_prf(predicted, expected, bank_match)

def eval_bank_roles(predicted: list, expected: list) -> Dict[str, float]:
    def bank_role_match(pred, exp):
        if not isinstance(pred, dict):
            return False
        pred_acc = re.sub(r'[\s\-]', '', pred.get("account_number", ""))
        exp_acc = re.sub(r'[\s\-]', '', exp.get("account_number", ""))
        if pred_acc != exp_acc:
            return False
        pred_role = str(pred.get("account_role", "")).lower()
        exp_role = str(exp.get("account_role", "")).lower()
        pred_victim = pred.get("is_victim_account", False)
        exp_victim = exp.get("is_victim_account", False)
        return pred_role == exp_role and pred_victim == exp_victim
    return compute_set_prf(predicted, expected, bank_role_match)

def eval_monetary_loss(predicted: float, expected: float, tolerance: float) -> Dict[str, Any]:
    if expected == 0:
        exact = (predicted == 0)
        return {"exact_match": exact, "relative_error": 0.0 if exact else 1.0, "within_tolerance": exact}
    try:
        rel_err = abs(float(predicted) - float(expected)) / float(expected)
        return {"exact_match": rel_err == 0.0, "relative_error": round(rel_err, 4), "within_tolerance": rel_err <= tolerance}
    except (TypeError, ValueError):
        return {"exact_match": False, "relative_error": 1.0, "within_tolerance": False}


# ─── Legal Section Evaluators (NEW in v2) ────────────────────────────────────

def normalize_section_label(label: str) -> str:
    """Normalize a section label for comparison: 'IPC 388' -> 'ipc 388', 'IT Act 66(C)' -> 'it act 66(c)'."""
    s = str(label).strip().lower()
    s = re.sub(r'\s+', ' ', s)
    # Normalize parentheses: 66(C) -> 66c, 120(B) -> 120b
    s = re.sub(r'\(([a-z0-9]+)\)', r'\1', s)
    return s

def eval_bns_sections(predicted: list, expected: list) -> Dict[str, float]:
    """Check that predicted legal sections match expected sections (exact preservation)."""
    def section_match(pred, exp):
        return normalize_section_label(pred) == normalize_section_label(exp)
    return compute_set_prf(predicted, expected, section_match)

def eval_no_bns_mislabeled(predicted: list, ipc_only_sections: list) -> bool:
    """
    Verify that NO IPC-only section numbers appear with a BNS prefix.
    E.g. if 'IPC 388' is in the input, 'BNS 388' must NOT appear in the output.
    """
    if not ipc_only_sections:
        return True
    bns_numbers = set()
    for sec in predicted:
        s = str(sec).strip()
        m = re.match(r'^BNS\s+(\d+)', s, re.IGNORECASE)
        if m:
            bns_numbers.add(m.group(1))
    # Any IPC-only section number that appears as BNS is a mislabel
    mislabeled = [num for num in ipc_only_sections if num in bns_numbers]
    return len(mislabeled) == 0


# ─── Main Validation Runner ─────────────────────────────────────────────────

def run_validation_v2(dataset_path: str = None, output_dir: str = None, delay_sec: float = 0.0) -> Dict[str, Any]:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not dataset_path:
        dataset_path = os.path.join(base_dir, "eval_dataset", "entity_extraction_validation_v2.json")
    if not output_dir:
        output_dir = os.path.join(base_dir, "eval_results")
    os.makedirs(output_dir, exist_ok=True)

    with open(dataset_path, "r", encoding="utf-8") as f:
        benchmark = json.load(f)

    test_cases = benchmark.get("test_cases", [])
    print(f"\n{'='*75}")
    print(f"    CRIME OS AI — VALIDATION SUITE v2 (LEGAL SECTIONS + ENTITIES)")
    print(f"{'='*75}")
    print(f"[+] Loaded {len(test_cases)} test cases from {os.path.basename(dataset_path)}\n")

    # Aggregate accumulators
    agg = {
        "language_correct": 0,
        "category_correct": 0,
        "sub_type_correct": 0,
        "severity_in_range": 0,
        "person_f1_sum": 0.0,
        "person_role_f1_sum": 0.0,
        "phone_f1_sum": 0.0,
        "email_f1_sum": 0.0,
        "handle_f1_sum": 0.0,
        "bank_f1_sum": 0.0,
        "bank_role_f1_sum": 0.0,
        "vpa_f1_sum": 0.0,
        "loss_within_tol": 0,
        "loss_rel_err_sum": 0.0,
        "section_f1_sum": 0.0,
        "no_mislabel_correct": 0,
        "total_latency": 0.0,
    }
    case_results = []

    for tc in test_cases:
        tc_id = tc["test_case_id"]
        expected = tc["expected_output"]
        exp_entities = expected.get("entities", {})

        print(f"[*] Running {tc_id}: {tc['description'][:60]}...")

        # Run the actual ingestion pipeline.
        # Retry (exponential backoff) + fallback/abort policy are handled centrally
        # inside process_multimodal_complaint via app.utils.error_policy
        # (configured via ERROR_POLICY, MAX_RETRIES, MAX_RETRY_WAIT_SEC, etc.).
        start_time = time.time()
        result = None
        try:
            result = process_multimodal_complaint(raw_text=tc["raw_input_text"], input_type=tc.get("input_type", "text"))
        except Exception as e:
            print(f"  [ERROR] Ingestion failed: {e}")
            result = None

        if result is None:
            case_results.append({"test_case_id": tc_id, "error": "Ingestion failed"})
            continue

        latency = time.time() - start_time
        agg["total_latency"] += latency
        if delay_sec > 0:
            time.sleep(delay_sec)

        pred_entities = result.get("entities", {})
        if not isinstance(pred_entities, dict):
            pred_entities = {}

        case_eval = {"test_case_id": tc_id, "latency_sec": round(latency, 2)}

        # --- Language ---
        lang_ok = eval_exact_match(result.get("original_language", ""), expected.get("original_language", ""))
        case_eval["language_match"] = lang_ok
        if lang_ok: agg["language_correct"] += 1

        # --- Crime Category ---
        cat_ok = eval_exact_match(result.get("crime_category", ""), expected.get("crime_category", ""))
        case_eval["category_match"] = cat_ok
        if cat_ok: agg["category_correct"] += 1

        # --- Crime Sub-Type ---
        sub_ok = eval_crime_sub_type(result.get("crime_sub_type", ""), expected.get("crime_sub_type_keywords", []))
        case_eval["sub_type_match"] = sub_ok
        if sub_ok: agg["sub_type_correct"] += 1

        # --- Severity ---
        sev_ok = eval_severity_range(result.get("severity_score", 0), expected.get("severity_score_range", [0, 10]))
        case_eval["severity_in_range"] = sev_ok
        if sev_ok: agg["severity_in_range"] += 1

        # --- Legal Sections (NEW) ---
        pred_sections = result.get("bns_sections_identified", [])
        exp_sections = expected.get("bns_sections_identified", [])
        section_prf = eval_bns_sections(pred_sections, exp_sections)
        case_eval["bns_sections_identified"] = section_prf
        case_eval["predicted_sections"] = pred_sections
        case_eval["expected_sections"] = exp_sections
        agg["section_f1_sum"] += section_prf["f1"]

        # --- No IPC mislabeled as BNS (NEW) ---
        ipc_only = expected.get("no_bns_mislabeled_from_ipc", [])
        no_mislabel = eval_no_bns_mislabeled(pred_sections, ipc_only)
        case_eval["no_bns_mislabeled"] = no_mislabel
        if no_mislabel: agg["no_mislabel_correct"] += 1

        # --- Persons ---
        pred_persons = pred_entities.get("persons", [])
        exp_persons = exp_entities.get("persons", [])
        persons_prf = eval_persons(pred_persons, exp_persons)
        persons_role_prf = eval_persons_with_role(pred_persons, exp_persons)
        case_eval["persons"] = persons_prf
        case_eval["persons_with_role"] = persons_role_prf
        agg["person_f1_sum"] += persons_prf["f1"]
        agg["person_role_f1_sum"] += persons_role_prf["f1"]

        # --- Phone Numbers ---
        pred_phones = pred_entities.get("phone_numbers", [])
        exp_phones = exp_entities.get("phone_numbers", [])
        phone_prf = eval_phone_numbers(pred_phones, exp_phones)
        case_eval["phone_numbers"] = phone_prf
        agg["phone_f1_sum"] += phone_prf["f1"]

        # --- Emails ---
        pred_emails = pred_entities.get("email_addresses", [])
        exp_emails = exp_entities.get("email_addresses", [])
        email_prf = eval_strings_ci(pred_emails, exp_emails)
        case_eval["email_addresses"] = email_prf
        agg["email_f1_sum"] += email_prf["f1"]

        # --- Handles ---
        pred_handles = pred_entities.get("online_handles", [])
        exp_handles = exp_entities.get("online_handles", [])
        handle_prf = eval_strings_ci(pred_handles, exp_handles)
        case_eval["online_handles"] = handle_prf
        agg["handle_f1_sum"] += handle_prf["f1"]

        # --- Bank Accounts ---
        pred_banks = pred_entities.get("bank_accounts", [])
        exp_banks = exp_entities.get("bank_accounts", [])
        bank_prf = eval_bank_accounts(pred_banks, exp_banks)
        bank_role_prf = eval_bank_roles(pred_banks, exp_banks)
        case_eval["bank_accounts"] = bank_prf
        case_eval["bank_account_roles"] = bank_role_prf
        agg["bank_f1_sum"] += bank_prf["f1"]
        agg["bank_role_f1_sum"] += bank_role_prf["f1"]

        # --- VPAs ---
        pred_vpas = pred_entities.get("vpas_upis", [])
        exp_vpas = exp_entities.get("vpas_upis", [])
        vpa_prf = eval_strings_ci(pred_vpas, exp_vpas)
        case_eval["vpas_upis"] = vpa_prf
        agg["vpa_f1_sum"] += vpa_prf["f1"]

        # --- Monetary Loss ---
        pred_loss = pred_entities.get("monetary_loss", 0)
        exp_loss = exp_entities.get("monetary_loss", 0)
        exp_tol = exp_entities.get("monetary_loss_tolerance", 0.05)
        loss_eval = eval_monetary_loss(pred_loss, exp_loss, exp_tol)
        case_eval["monetary_loss"] = loss_eval
        if loss_eval.get("within_tolerance", False): agg["loss_within_tol"] += 1
        agg["loss_rel_err_sum"] += loss_eval.get("relative_error", 1.0)

        # --- Fallback ---
        case_eval["fallback_used"] = result.get("fallback_used", False)

        case_results.append(case_eval)

        # Per-case summary
        status = "✓" if (lang_ok and cat_ok and sub_ok) else "△"
        fallback_tag = " [FALLBACK]" if result.get("fallback_used") else ""
        print(f"  [{status}] Lang={lang_ok} Cat={cat_ok} Sub={sub_ok} Sev={sev_ok} "
              f"Sections={section_prf['f1']:.2f} NoMislabel={no_mislabel} "
              f"Persons={persons_prf['f1']:.2f} Phones={phone_prf['f1']:.2f} "
              f"Banks={bank_prf['f1']:.2f} VPAs={vpa_prf['f1']:.2f} "
              f"Loss={loss_eval.get('relative_error', 1.0):.2f} ({latency:.1f}s){fallback_tag}")
        if pred_sections:
            print(f"       Sections: {pred_sections}")

    # ─── Aggregate Scorecard ──────────────────────────────────────────────
    n = len(test_cases)
    n_valid = len([c for c in case_results if "error" not in c])
    if n_valid == 0:
        print("\n[!] No valid test cases completed. Cannot compute aggregate scores.")
        return {"error": "No valid test cases"}

    scorecard = {
        "total_cases": n,
        "valid_cases": n_valid,
        "language_accuracy": round(agg["language_correct"] / n_valid * 100, 1),
        "category_accuracy": round(agg["category_correct"] / n_valid * 100, 1),
        "sub_type_accuracy": round(agg["sub_type_correct"] / n_valid * 100, 1),
        "severity_in_range_pct": round(agg["severity_in_range"] / n_valid * 100, 1),
        "legal_section_preservation_f1": round(agg["section_f1_sum"] / n_valid * 100, 1),
        "no_bns_mislabel_accuracy": round(agg["no_mislabel_correct"] / n_valid * 100, 1),
        "person_extraction_f1": round(agg["person_f1_sum"] / n_valid * 100, 1),
        "person_role_f1": round(agg["person_role_f1_sum"] / n_valid * 100, 1),
        "phone_extraction_f1": round(agg["phone_f1_sum"] / n_valid * 100, 1),
        "email_extraction_f1": round(agg["email_f1_sum"] / n_valid * 100, 1),
        "handle_extraction_f1": round(agg["handle_f1_sum"] / n_valid * 100, 1),
        "bank_account_f1": round(agg["bank_f1_sum"] / n_valid * 100, 1),
        "bank_role_accuracy_f1": round(agg["bank_role_f1_sum"] / n_valid * 100, 1),
        "vpa_extraction_f1": round(agg["vpa_f1_sum"] / n_valid * 100, 1),
        "monetary_loss_accuracy": round(agg["loss_within_tol"] / n_valid * 100, 1),
        "monetary_loss_avg_rel_error": round(agg["loss_rel_err_sum"] / n_valid, 4),
        "avg_latency_sec": round(agg["total_latency"] / n_valid, 2),
        "fallback_rate": round(sum(1 for c in case_results if c.get("fallback_used")) / n_valid * 100, 1),
    }

    # Overall entity F1 (average of all entity-field F1 scores)
    entity_f1_fields = [
        scorecard["person_extraction_f1"],
        scorecard["phone_extraction_f1"],
        scorecard["email_extraction_f1"],
        scorecard["handle_extraction_f1"],
        scorecard["bank_account_f1"],
        scorecard["vpa_extraction_f1"],
    ]
    scorecard["overall_entity_f1"] = round(sum(entity_f1_fields) / len(entity_f1_fields), 1)

    print(f"\n{'='*75}")
    print(f"           VALIDATION SUITE v2 — SCORECARD")
    print(f"{'='*75}")
    print(f" Test Cases Evaluated:           {n_valid}/{n}")
    print(f" Fallback Rate:                  {scorecard['fallback_rate']}%")
    print(f"{'─'*75}")
    print(f" CLASSIFICATION METRICS:")
    print(f"   • Language Detection Accuracy:    {scorecard['language_accuracy']}%")
    print(f"   • Crime Category Accuracy:        {scorecard['category_accuracy']}%")
    print(f"   • Crime Sub-Type Accuracy:        {scorecard['sub_type_accuracy']}%")
    print(f"   • Severity Score In-Range:         {scorecard['severity_in_range_pct']}%")
    print(f"{'─'*75}")
    print(f" LEGAL SECTION METRICS (NEW):")
    print(f"   • Section Preservation F1:        {scorecard['legal_section_preservation_f1']}%")
    print(f"   • No IPC→BNS Mislabel Accuracy:   {scorecard['no_bns_mislabel_accuracy']}%")
    print(f"{'─'*75}")
    print(f" ENTITY EXTRACTION METRICS (F1 %):")
    print(f"   • Person Names F1:                {scorecard['person_extraction_f1']}%")
    print(f"   • Person Names + Role F1:         {scorecard['person_role_f1']}%")
    print(f"   • Phone Numbers F1:               {scorecard['phone_extraction_f1']}%")
    print(f"   • Email Addresses F1:             {scorecard['email_extraction_f1']}%")
    print(f"   • Online Handles F1:              {scorecard['handle_extraction_f1']}%")
    print(f"   • Bank Accounts F1:               {scorecard['bank_account_f1']}%")
    print(f"   • Bank Account Role Accuracy F1:  {scorecard['bank_role_accuracy_f1']}%")
    print(f"   • VPA/UPI F1:                     {scorecard['vpa_extraction_f1']}%")
    print(f"   • Overall Entity F1:              {scorecard['overall_entity_f1']}%")
    print(f"{'─'*75}")
    print(f" MONETARY LOSS:")
    print(f"   • Accuracy (within tolerance):    {scorecard['monetary_loss_accuracy']}%")
    print(f"   • Avg Relative Error:             {scorecard['monetary_loss_avg_rel_error']}")
    print(f"{'─'*75}")
    print(f" PERFORMANCE:")
    print(f"   • Avg Latency:                    {scorecard['avg_latency_sec']}s")
    print(f"{'='*75}\n")

    # Save results
    results_payload = {
        "layer": "validation_v2",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "scorecard": scorecard,
        "per_case_results": case_results
    }
    out_file = os.path.join(output_dir, f"validation_v2_{time.strftime('%Y%m%d_%H%M%S')}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2, ensure_ascii=False)
    print(f"[+] Results saved to: {out_file}")

    return results_payload


if __name__ == "__main__":
    run_validation_v2()
