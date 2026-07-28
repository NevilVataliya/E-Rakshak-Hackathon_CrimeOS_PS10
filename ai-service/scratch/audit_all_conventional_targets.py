import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def audit_all_16_conventional_targets():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'COMPOSITE_MULTI_DOCUMENT']

    print(f"=========================================================================")
    print(f"[*] AUDITING ALL 16 CONVENTIONAL TARGET TOPICS IN COMPOSITE TEST CASES")
    print(f"=========================================================================\n", flush=True)

    for idx, tc in enumerate(composite_cases, 1):
        tc_id = tc["test_case_id"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        
        for tgt in tc["ground_truth_targets"]:
            if tgt["target_specialist"] == "conventional_field_specialist":
                print(f"[{idx:2d}/16] {tc_id} | Crime: '{crime_sub}'")
                print(f"       Target Doc:  '{tgt['source_document']}' (Page {tgt['page_number']})")
                print(f"       Narrative:   \"{narrative[:150]}...\"\n")

if __name__ == "__main__":
    audit_all_16_conventional_targets()
