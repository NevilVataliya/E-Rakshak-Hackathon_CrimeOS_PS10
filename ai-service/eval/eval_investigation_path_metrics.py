import os
import sys
import json
import re
from typing import Dict, Any, List, Set, Tuple

def extract_legal_citations(text: str) -> Set[str]:
    """Extracts standardized legal citations from a text block."""
    text_upper = text.upper()
    citations = set()

    # BNS section patterns
    bns_matches = re.findall(r'\b(?:BNS|SECTION|SEC|U/S)\s*(\d+[A-Z]?(?:\(\d+\))?)\s*(?:BNS)?\b', text_upper)
    for m in bns_matches:
        citations.add(f"BNS_{m}")

    # IT Act section patterns
    it_matches = re.findall(r'\b(?:IT ACT|SECTION|SEC|U/S)\s*(66D|66C|66|43|70|72)\b', text_upper)
    for m in it_matches:
        citations.add(f"IT_{m}")

    # BSA section patterns
    bsa_matches = re.findall(r'\b(?:BSA|SAKSHYA|SECTION|SEC|U/S)\s*(63|61|62|65B)\b', text_upper)
    for m in bsa_matches:
        citations.add(f"BSA_{m}")

    # BNSS section patterns
    bnss_matches = re.findall(r'\b(?:BNSS|NAGARIK|SECTION|SEC|U/S)\s*(105|94|183|35|173)\b', text_upper)
    for m in bnss_matches:
        citations.add(f"BNSS_{m}")

    return citations

def eval_trajectory_alignment(generated_steps: List[Dict[str, Any]], ideal_path: Dict[str, List[str]]) -> Dict[str, Any]:
    """
    Evaluates trajectory alignment across 4 mandatory investigation stages:
    1. Emergency Response (Freeze / Lien)
    2. Technical Requisition (CDR / IP / BNSS 94)
    3. Evidence & Forensics (BSA 63 / BNSS 105 Panchnama)
    4. Statutory Sections & Procedure
    """
    flat_steps_text = " ".join([
        f"{s.get('title', '')} {s.get('description', '')} {s.get('sop_reference', '')}".lower()
        for s in generated_steps
    ])

    stage_scores = {}
    total_found = 0
    total_expected = 0

    for stage_name, expected_actions in ideal_path.items():
        matched_actions = 0
        for action in expected_actions:
            # Extract key action terms
            keywords = [w.lower() for w in re.findall(r'\w+', action) if len(w) > 3]
            if not keywords:
                continue
            hits = sum(1 for kw in keywords if kw in flat_steps_text)
            if (hits / len(keywords)) >= 0.4:
                matched_actions += 1

        stage_score = matched_actions / len(expected_actions) if expected_actions else 1.0
        stage_scores[stage_name] = round(stage_score, 4)
        total_found += matched_actions
        total_expected += len(expected_actions)

    overall_trajectory_recall = round(total_found / max(total_expected, 1), 4)

    return {
        "trajectory_recall": overall_trajectory_recall,
        "stage_scores": stage_scores,
        "actions_matched": total_found,
        "total_actions_expected": total_expected
    }

def eval_statutory_citation_metrics(flat_output: str, ground_truth_sections: List[str]) -> Dict[str, Any]:
    """
    Calculates Precision, Recall, and F1 for statutory legal section citations.
    """
    flat_upper = flat_output.upper()
    gt_found = 0

    for gt_sec in ground_truth_sections:
        tokens = [t.strip().upper() for t in gt_sec.split() if t.strip()]
        if not tokens:
            continue
        if all(re.search(r'\b' + re.escape(t) + r'\b', flat_upper) for t in tokens):
            gt_found += 1

    recall = gt_found / len(ground_truth_sections) if ground_truth_sections else 1.0

    cited_sections = extract_legal_citations(flat_output)
    valid_citations = 0
    for c in cited_sections:
        if any(gt.upper() in c or c in gt.upper() for gt in ground_truth_sections):
            valid_citations += 1

    precision = valid_citations / len(cited_sections) if cited_sections else 1.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "citation_precision": round(precision, 4),
        "citation_recall": round(recall, 4),
        "citation_f1": round(f1, 4),
        "sections_found_count": gt_found,
        "total_expected_sections": len(ground_truth_sections)
    }


def eval_procedural_safety_compliance(output: dict, complaint_text: str, forbidden_actions: List[str]) -> Dict[str, Any]:
    """
    Evaluates Gujarat Police Manual compliance and safety violations
    (e.g., checking if complainant/victim account was mistakenly frozen).
    """
    flat_text = json.dumps(output).lower()
    violations = []

    # 1. Safety Check: Complainant Account Freezing
    victim_accounts = set(re.findall(r'\b\d{9,18}\b', complaint_text))
    for va in victim_accounts:
        if f"freeze {va}" in flat_text or f"lien {va}" in flat_text:
            violations.append(f"Safety Violation: Attempted to freeze victim account {va}")

    for forb in forbidden_actions:
        if forb.lower() in flat_text:
            violations.append(f"Forbidden Action Executed: '{forb}'")

    # 2. Gujarat Police Manual & BNSS Compliance Check
    has_1930_freeze = "1930" in flat_text or "freeze" in flat_text or "lien" in flat_text
    has_bsa_63_cert = "section 63" in flat_text or "65b" in flat_text or "certificate" in flat_text
    has_bnss_105_panchnama = "panchnama" in flat_text or "105" in flat_text or "video" in flat_text

    procedural_score = (1.0 if has_1930_freeze else 0.5) * (1.0 if has_bsa_63_cert else 0.5) * (1.0 if has_bnss_105_panchnama else 0.5)
    safety_score = 1.0 if not violations else 0.0

    return {
        "procedural_compliance_score": round(procedural_score, 4),
        "safety_score": round(safety_score, 4),
        "violations": violations
    }
