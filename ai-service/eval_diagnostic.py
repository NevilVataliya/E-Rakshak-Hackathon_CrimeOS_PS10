import json
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
entity_gold_path = os.path.join(base_dir, "eval_dataset", "entity_extraction_gold.json")
with open(entity_gold_path, "r", encoding="utf-8") as f:
    entity_gold = json.load(f)

# The most recent entity evaluation results
eval_file = os.path.join(base_dir, "eval_results", "entity_eval_20260730_164815.json")
with open(eval_file, "r", encoding="utf-8") as f:
    entity_eval = json.load(f)

print("--- DIAGNOSTIC 1: Victim Account Freezes (INV-001, 002, 009) -> (EE-001, EE-002, EE-009) ---")
for tc_id in ["EE-001", "EE-002", "EE-009"]:
    # Get ground truth
    gt_tc = next((tc for tc in entity_gold["test_cases"] if tc["test_case_id"] == tc_id), None)
    gt_banks = gt_tc["expected_output"]["entities"].get("bank_accounts", []) if gt_tc else []
    
    # Get eval scorecard
    ev_tc = next((tc for tc in entity_eval["per_case_results"] if tc["test_case_id"] == tc_id), None)
    bank_f1 = ev_tc["bank_account_roles"]["f1"] if ev_tc else 0
    
    print(f"\n[{tc_id}] Ground Truth Banks: {gt_banks}")
    print(f"[{tc_id}] Extraction Role F1: {bank_f1}")

print("\n--- DIAGNOSTIC 2: Monetary Loss Accuracy Failures ---")
for ev_tc in entity_eval["per_case_results"]:
    loss = ev_tc.get("monetary_loss", {})
    if not loss.get("exact_match", True):
        tc_id = ev_tc["test_case_id"]
        gt_tc = next((tc for tc in entity_gold["test_cases"] if tc["test_case_id"] == tc_id), None)
        gt_loss = gt_tc["expected_output"]["entities"].get("monetary_loss")
        print(f"[{tc_id}] Failed Exact Match. Relative Error: {loss.get('relative_error')}. GT Loss: {gt_loss}")

print("\n--- DIAGNOSTIC 3: Entity Precision for Person Roles ---")
for ev_tc in entity_eval["per_case_results"]:
    person_f1 = ev_tc.get("persons_with_role", {}).get("f1", 1.0)
    if person_f1 < 1.0:
        print(f"[{ev_tc['test_case_id']}] Person Role F1: {person_f1}")
