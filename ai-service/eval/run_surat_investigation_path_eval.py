import os
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, List

# Ensure ai-service root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.orchestrator import investigation_graph
from eval.eval_investigation_path_metrics import (
    eval_trajectory_alignment,
    eval_statutory_citation_metrics,
    eval_procedural_safety_compliance
)

DATASET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "eval_dataset", "surat_police_investigation_dataset.json")
RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "eval_results")

def flatten_investigation_output(output: dict) -> str:
    parts = []
    fir = output.get("master_fir_details", {})
    if isinstance(fir, dict):
        parts.append(json.dumps(fir))

    for step in output.get("investigation_steps", []):
        if isinstance(step, dict):
            parts.append(f"{step.get('title', '')} {step.get('description', '')} {step.get('sop_reference', '')}")
        else:
            parts.append(str(step))

    for req in output.get("legal_requests_to_generate", []):
        if isinstance(req, dict):
            parts.append(f"{req.get('request_type', '')} {req.get('target_provider', '')} {req.get('description', '')}")
        else:
            parts.append(str(req))

    parts.append(output.get("summary", ""))

    for key in ["bns_draft", "bsa_draft", "cyber_draft", "conventional_draft"]:
        draft = output.get(key)
        if draft:
            parts.append(json.dumps(draft) if isinstance(draft, dict) else str(draft))

    return " ".join(parts)

def run_surat_investigation_evaluation():
    print(f"\n===========================================================================")
    print(f"   CRIME OS AI — SURAT POLICE REAL-WORLD INVESTIGATION PATH BENCHMARK")
    print(f"===========================================================================")

    if not os.path.exists(DATASET_PATH):
        print(f"[-] Error: Dataset file not found at {DATASET_PATH}")
        return

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    test_cases = dataset.get("test_cases", [])
    print(f"[+] Loaded Surat Police Benchmark Version: {dataset.get('dataset_info', {}).get('version', '1.0')}")
    print(f"[+] Total Investigation Cases to Evaluate: {len(test_cases)}\n")

    case_results = []
    agg = {
        "trajectory_recall_sum": 0.0,
        "citation_precision_sum": 0.0,
        "citation_recall_sum": 0.0,
        "citation_f1_sum": 0.0,
        "procedural_score_sum": 0.0,
        "safety_score_sum": 0.0,
        "total_latency_sec": 0.0,
        "valid_count": 0
    }

    for idx, tc in enumerate(test_cases, 1):
        case_id = tc["case_id"]
        ps_name = tc.get("police_station", "Surat Police Station")
        complaint_text = tc["complaint_text"]
        extracted_entities = tc.get("extracted_entities", {})
        ideal_path = tc.get("ideal_investigation_path", {})
        must_have_sections = tc.get("must_have_legal_sections", [])
        forbidden_actions = tc.get("forbidden_actions", [])

        print(f"[*] [{idx}/{len(test_cases)}] Evaluating {case_id} ({ps_name})...")

        state_input = {
            "case_id": case_id,
            "case_number": f"CR-SURAT-{case_id[-3:]}",
            "complaint_text": complaint_text,
            "translated_text": complaint_text,
            "original_language": tc.get("complaint_language", "gu_en_mix"),
            "crime_category": tc.get("crime_category", "CYBER_FINANCIAL"),
            "crime_sub_type": tc.get("crime_sub_type", "Investigation"),
            "entities": extracted_entities,
            "active_specialists": [],
            "cross_case_matches": [],
            "evaluation_status": "PENDING",
            "evaluation_feedback": [],
            "iteration_count": 0,
            "hitl_approved": False,
            "io_custom_notes": ""
        }

        start_t = time.time()
        output = None
        for attempt in range(1, 4):
            try:
                output = investigation_graph.invoke(state_input)
                break
            except Exception as e:
                err_str = str(e)
                if ("rate_limit" in err_str.lower() or "429" in err_str or "tokens" in err_str.lower()) and attempt < 3:
                    wait_sec = 15 * attempt
                    print(f"  [!] Rate limit (429) hit. Retrying in {wait_sec}s (Attempt {attempt}/3)...")
                    time.sleep(wait_sec)
                else:
                    print(f"  [-] Pipeline Exception for {case_id}: {e}")
                    break

        latency = time.time() - start_t
        if output is None:
            continue

        # Inter-case delay to respect Groq TPM tier
        time.sleep(8)


        flat_output = flatten_investigation_output(output)
        gen_steps = output.get("investigation_steps", [])

        # Run metric evaluation
        traj_res = eval_trajectory_alignment(gen_steps, ideal_path)
        cite_res = eval_statutory_citation_metrics(flat_output, must_have_sections)
        proc_res = eval_procedural_safety_compliance(output, complaint_text, forbidden_actions)

        # Accumulate
        agg["trajectory_recall_sum"] += traj_res["trajectory_recall"]
        agg["citation_precision_sum"] += cite_res["citation_precision"]
        agg["citation_recall_sum"] += cite_res["citation_recall"]
        agg["citation_f1_sum"] += cite_res["citation_f1"]
        agg["procedural_score_sum"] += proc_res["procedural_compliance_score"]
        agg["safety_score_sum"] += proc_res["safety_score"]
        agg["total_latency_sec"] += latency
        agg["valid_count"] += 1

        print(f"    -> Trajectory Recall: {traj_res['trajectory_recall']:.1%} | Citation F1: {cite_res['citation_f1']:.1%} | Safety: {proc_res['safety_score']:.1%} ({latency:.1f}s)")

        case_results.append({
            "case_id": case_id,
            "police_station": ps_name,
            "latency_sec": round(latency, 2),
            "trajectory_alignment": traj_res,
            "citation_metrics": cite_res,
            "procedural_compliance": proc_res
        })

    n = max(agg["valid_count"], 1)
    mean_traj_recall = round(agg["trajectory_recall_sum"] / n, 4)
    mean_cite_prec = round(agg["citation_precision_sum"] / n, 4)
    mean_cite_rec = round(agg["citation_recall_sum"] / n, 4)
    mean_cite_f1 = round(agg["citation_f1_sum"] / n, 4)
    mean_proc_score = round(agg["procedural_score_sum"] / n, 4)
    mean_safety = round(agg["safety_score_sum"] / n, 4)
    avg_latency = round((agg["total_latency_sec"] / n) * 1000, 1)

    print("\n===========================================================================")
    print("      CRIME OS AI — SURAT POLICE INVESTIGATION PATH SCORECARD")
    print("===========================================================================")
    print(f" • Investigation Trajectory Recall:      {mean_traj_recall * 100:.1f}%   (Target: ≥ 85.0%)")
    print(f" • Statutory Citation Precision:         {mean_cite_prec * 100:.1f}%   (Target: ≥ 90.0%)")
    print(f" • Statutory Citation Recall:            {mean_cite_rec * 100:.1f}%")
    print(f" • Statutory Citation F1 Score:          {mean_cite_f1 * 100:.1f}%")
    print(f" • Procedural Compliance Score:         {mean_proc_score * 100:.1f}%")
    print(f" • Safety Violation Free Rate:           {mean_safety * 100:.1f}%   (Target: 100.0%)")
    print(f" • Average Pipeline Latency:             {avg_latency:.1f}ms")
    print("===========================================================================\n")

    os.makedirs(RESULTS_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(RESULTS_DIR, f"surat_investigation_path_eval_{ts}.json")

    results_payload = {
        "benchmark_name": "Surat Police Real-World Investigation Path Benchmark",
        "timestamp": datetime.now().isoformat(),
        "total_cases_evaluated": agg["valid_count"],
        "scorecard": {
            "trajectory_recall": mean_traj_recall * 100,
            "citation_precision": mean_cite_prec * 100,
            "citation_recall": mean_cite_rec * 100,
            "citation_f1": mean_cite_f1 * 100,
            "procedural_compliance_score": mean_proc_score * 100,
            "safety_score": mean_safety * 100,
            "avg_latency_ms": avg_latency
        },
        "case_details": case_results
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2)

    print(f"[+] Scorecard & detailed case evaluations saved to: {out_path}")
    return results_payload

if __name__ == "__main__":
    run_surat_investigation_evaluation()
