import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops
from eval.run_rag_benchmark import is_chunk_hit, run_rag_benchmark_evaluation

print("=========================================================================")
print("  TESTING REASONED HYDE ASPECT EXPANSION FOR HIGHER COMPOSITE RECALL")
print("=========================================================================")

# Run benchmark evaluation
res = run_rag_benchmark_evaluation()
scorecard = res.get("scorecard", {})
print("\n--- BASELINE RECOVERY SCORECARD ---")
print(f"Atomic Hit Rate @ 5: {scorecard.get('atomic', {}).get('hit_rate_k5')}%")
print(f"Atomic Hit Rate @ 15: {scorecard.get('atomic', {}).get('hit_rate_k15')}%")
print(f"Composite Target Recall: {scorecard.get('composite', {}).get('target_recall')}%")
