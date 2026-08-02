import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eval.run_rag_benchmark import run_rag_benchmark_evaluation

print("=========================================================================")
print("   EVALUATING UNIVERSAL RAG PERFORMANCE ACROSS BENCHMARK V2 AND V3")
print("=========================================================================")

v2_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset", "rag_benchmark_v2.json")
v3_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset", "rag_benchmark_v3.json")

print("\n[>>>] EVALUATING DATASET V2:")
res_v2 = run_rag_benchmark_evaluation(dataset_path=v2_path)
sc_v2 = res_v2.get("scorecard", {})

print("\n[>>>] EVALUATING DATASET V3:")
res_v3 = run_rag_benchmark_evaluation(dataset_path=v3_path)
sc_v3 = res_v3.get("scorecard", {})

print("\n=========================================================================")
print("                    UNIVERSAL RAG COMPARISON SCORECARD")
print("=========================================================================")
print(f" Dataset v2 -> Atomic Hit@5: {sc_v2.get('atomic',{}).get('hit_rate_k5')}% | Atomic Hit@15: {sc_v2.get('atomic',{}).get('hit_rate_k15')}% | Composite Recall: {sc_v2.get('composite',{}).get('target_recall')}%")
print(f" Dataset v3 -> Atomic Hit@5: {sc_v3.get('atomic',{}).get('hit_rate_k5')}% | Atomic Hit@15: {sc_v3.get('atomic',{}).get('hit_rate_k15')}% | Composite Recall: {sc_v3.get('composite',{}).get('target_recall')}%")
print("=========================================================================")
