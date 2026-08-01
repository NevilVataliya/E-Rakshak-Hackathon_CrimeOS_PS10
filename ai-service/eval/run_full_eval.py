"""
CrimeOS AI — Full System Evaluation Runner
============================================
Unified entry point that runs all 3 evaluation layers sequentially
and produces a combined scorecard + historical JSON output.

Usage:
  python eval/run_full_eval.py                    # Run all 3 layers
  python eval/run_full_eval.py --layer 1          # Run only Layer 1 (Entity Extraction)
  python eval/run_full_eval.py --layer 2          # Run only Layer 2 (RAG Retrieval)
  python eval/run_full_eval.py --layer 3          # Run only Layer 3 (Investigation Path)
  python eval/run_full_eval.py --layer 1 --layer 2  # Run Layers 1 and 2
"""

import os
import sys
import json
import time
import argparse

# Ensure ai-service root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eval.run_entity_eval import run_entity_extraction_evaluation
from eval.run_rag_benchmark import run_rag_benchmark_evaluation
from eval.run_investigation_eval import run_investigation_evaluation


def print_combined_scorecard(results: dict):
    """Print the unified scorecard combining all layers."""
    print(f"\n{'═'*75}")
    print(f"       CRIME OS AI — FULL SYSTEM EVALUATION SCORECARD")
    print(f"{'═'*75}")

    # Layer 1
    if "entity_extraction" in results:
        s = results["entity_extraction"].get("scorecard", {})
        if "error" not in results["entity_extraction"]:
            print(f" LAYER 1: ENTITY EXTRACTION ({s.get('valid_cases', '?')}/{s.get('total_cases', '?')} Test Cases)")
            print(f"   • Language Detection Accuracy:    {s.get('language_accuracy', 'N/A')}%")
            print(f"   • Crime Category Accuracy:        {s.get('category_accuracy', 'N/A')}%")
            print(f"   • Crime Sub-Type Accuracy:        {s.get('sub_type_accuracy', 'N/A')}%")
            print(f"   • Person Extraction F1:           {s.get('person_extraction_f1', 'N/A')}%")
            print(f"   • Phone Number Extraction F1:     {s.get('phone_extraction_f1', 'N/A')}%")
            print(f"   • Bank Account Extraction F1:     {s.get('bank_account_f1', 'N/A')}%")
            print(f"   • VPA/UPI Extraction F1:          {s.get('vpa_extraction_f1', 'N/A')}%")
            print(f"   • Monetary Loss Accuracy:         {s.get('monetary_loss_accuracy', 'N/A')}%")
            print(f"   • Overall Entity F1:              {s.get('overall_entity_f1', 'N/A')}%")
            print(f"   • Fallback Rate:                  {s.get('fallback_rate', 'N/A')}%")
            print(f"   • Avg Latency:                    {s.get('avg_latency_sec', 'N/A')}s")
        else:
            print(f" LAYER 1: ENTITY EXTRACTION — ERROR")
        print(f"{'─'*75}")

    # Layer 2
    if "rag_retrieval" in results:
        r = results["rag_retrieval"]
        if "error" not in r:
            sa = r.get("scorecard", {}).get("atomic", {})
            sc = r.get("scorecard", {}).get("composite", {})
            print(f" LAYER 2: RAG RETRIEVAL ({sa.get('count', '?')} Atomic + {sc.get('count', '?')} Composite)")
            print(f"   • Hit Rate @ 5:                   {sa.get('hit_rate_k5', 'N/A')}%   (Target: ≥ 95%)")
            print(f"   • MRR:                            {sa.get('mrr', 'N/A')}    (Target: ≥ 0.850)")
            print(f"   • NDCG @ 10:                      {sa.get('ndcg_k10', 'N/A')}")
            print(f"   • Multi-Target Recall:            {sc.get('target_recall', 'N/A')}%")
            print(f"   • Avg Latency:                    {sa.get('avg_latency_ms', 'N/A')}ms")
        else:
            print(f" LAYER 2: RAG RETRIEVAL — ERROR")
        print(f"{'─'*75}")

    # Layer 3
    if "investigation_path" in results:
        i = results["investigation_path"]
        if "error" not in i:
            s = i.get("scorecard", {})
            print(f" LAYER 3: INVESTIGATION PATH ({s.get('valid_cases', '?')}/{s.get('total_cases', '?')} Test Cases)")
            print(f"   • Legal Section Recall:           {s.get('legal_section_recall', 'N/A')}%")
            print(f"   • Directive Completeness:         {s.get('directive_completeness', 'N/A')}%")
            print(f"   • Faithfulness (No Hallucination): {s.get('faithfulness', 'N/A')}%")
            print(f"   • Safety (No Harmful Actions):    {s.get('safety', 'N/A')}%")
            print(f"   • Actionability (LLM Judge):      {s.get('actionability_avg', 'N/A')}/5.0")
            print(f"   • Avg Pipeline Latency:           {s.get('avg_latency_sec', 'N/A')}s")
        else:
            print(f" LAYER 3: INVESTIGATION PATH — ERROR")

    print(f"{'═'*75}\n")


def run_full_evaluation(layers: list = None, delay_sec: float = 2.0, provider: str = None):
    """
    Run the full evaluation suite (or selected layers).
    Args:
        layers: List of layer numbers to run [1, 2, 3]. None = all.
        delay_sec: Delay between test cases in seconds.
        provider: LLM provider to override ('gemini', 'groq', 'openai', etc.)
    """
    if layers is None:
        layers = [1, 2, 3]

    if provider:
        os.environ["LLM_PROVIDER"] = provider.lower()

    active_provider = os.getenv("LLM_PROVIDER", "auto")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "eval_results")
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n{'═'*75}")
    print(f"       CRIME OS AI — FULL SYSTEM EVALUATION RUNNER")
    print(f"{'═'*75}")
    print(f"[+] Layers to evaluate: {layers}")
    print(f"[+] Active LLM Provider: {active_provider}")
    print(f"[+] Inter-case delay: {delay_sec}s")
    print(f"[+] Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[+] Output directory: {output_dir}\n")

    results = {}
    total_start = time.time()

    # Layer 1: Entity Extraction
    if 1 in layers:
        print(f"\n{'▶'*3} STARTING LAYER 1: ENTITY EXTRACTION {'◀'*3}")
        try:
            results["entity_extraction"] = run_entity_extraction_evaluation(output_dir=output_dir, delay_sec=delay_sec)
        except Exception as e:
            print(f"[ERROR] Layer 1 failed: {e}")
            results["entity_extraction"] = {"error": str(e)}

    # Layer 2: RAG Retrieval
    if 2 in layers:
        print(f"\n{'▶'*3} STARTING LAYER 2: RAG RETRIEVAL {'◀'*3}")
        try:
            results["rag_retrieval"] = run_rag_benchmark_evaluation(output_dir=output_dir)
        except Exception as e:
            print(f"[ERROR] Layer 2 failed: {e}")
            results["rag_retrieval"] = {"error": str(e)}

    # Layer 3: Investigation Path
    if 3 in layers:
        print(f"\n{'▶'*3} STARTING LAYER 3: INVESTIGATION PATH {'◀'*3}")
        try:
            results["investigation_path"] = run_investigation_evaluation(output_dir=output_dir, delay_sec=delay_sec)
        except Exception as e:
            print(f"[ERROR] Layer 3 failed: {e}")
            results["investigation_path"] = {"error": str(e)}

    total_time = time.time() - total_start

    # Print combined scorecard
    print_combined_scorecard(results)
    print(f"[+] Total evaluation time: {total_time:.1f}s")

    # Save combined results
    combined_payload = {
        "evaluation_type": "full_system",
        "layers_evaluated": layers,
        "active_provider": active_provider,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total_duration_sec": round(total_time, 2),
        "results": {}
    }
    for layer_name, layer_result in results.items():
        if "error" in layer_result:
            combined_payload["results"][layer_name] = {"error": layer_result["error"]}
        else:
            combined_payload["results"][layer_name] = {"scorecard": layer_result.get("scorecard", {})}

    combined_file = os.path.join(output_dir, f"eval_run_{time.strftime('%Y%m%d_%H%M%S')}.json")
    with open(combined_file, "w", encoding="utf-8") as f:
        json.dump(combined_payload, f, indent=2, ensure_ascii=False)
    print(f"[+] Combined results saved to: {combined_file}")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CrimeOS AI Full System Evaluation")
    parser.add_argument("--layer", type=int, action="append", choices=[1, 2, 3],
                        help="Which layers to run (1=Entity, 2=RAG, 3=Investigation). Repeat for multiple. Default: all.")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between test cases in seconds (default: 2.0).")
    parser.add_argument("--provider", type=str, default=None, choices=["gemini", "groq", "openai", "claude"],
                        help="Override LLM provider (e.g. --provider gemini).")
    args = parser.parse_args()

    layers = args.layer if args.layer else [1, 2, 3]
    run_full_evaluation(layers=layers, delay_sec=args.delay, provider=args.provider)
