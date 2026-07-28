import os
import sys
import json
import re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.query_optimizer import DOMAIN_TRIGGER_MAP

def extract_dynamic_narrative_subquery(complaint_text: str, target_specialist: str, crime_sub_type: str = "", entities: dict = None) -> str:
    """
    Extracts dynamic narrative sentences, domain-specific triggers, and entities
    tailored to the requesting specialist domain WITHOUT hardcoding static act names.
    Searches across the full legal corpus without vector bias.
    """
    spec = str(target_specialist).lower().strip()
    entities = entities or {}
    
    # Domain specific intent triggers from narrative
    spec_triggers = []
    if "cyber" in spec:
        spec_triggers = ["vpa", "upi", "bank", "account", "phone", "telegram", "whatsapp", "online", "fraud", "ip", "url", "portal", "1930"]
    elif "bsa" in spec or "evidence" in spec:
        spec_triggers = ["evidence", "certificate", "record", "statement", "hash", "proof", "seizure", "admissibility", "witness"]
    elif "conventional" in spec or "procedural" in spec:
        spec_triggers = ["procedure", "investigation", "panchnama", "cctv", "spot", "fir", "diary", "warrant", "summon", "court"]
    else: # bns / penal
        spec_triggers = ["cheating", "fraud", "extortion", "impersonation", "theft", "loss", "deception", "threat", "money", "rupees"]

    # Extract matching sentences from narrative
    sentences = [s.strip() for s in re.split(r'[.!?\n]', complaint_text) if s.strip()]
    relevant_sentences = []
    
    for sentence in sentences:
        s_lower = sentence.lower()
        if any(trig in s_lower for trig in spec_triggers):
            relevant_sentences.append(sentence)

    # Fallback to narrative snippet if no specific sentence matched
    extracted_context = " ".join(relevant_sentences[:3]) if relevant_sentences else complaint_text[:300]
    
    # Collect extracted entities relevant to domain
    entity_str = ""
    if "cyber" in spec:
        vpas = " ".join(entities.get('vpas_upis') or [])
        phones = " ".join(entities.get('phone_numbers') or [])
        banks = " ".join([b.get('account_number','') for b in (entities.get('bank_accounts') or []) if isinstance(b, dict)])
        entity_str = f"{vpas} {phones} {banks}".strip()
    elif "bsa" in spec:
        entity_str = "electronic evidence hash certificate chain of custody"

    # Extract any explicit section references mentioned in text
    sec_matches = re.findall(r'\b(?:Section|Sec|u/s)\s*\d+[A-Z]?(?:\(\d+\))?', complaint_text, re.IGNORECASE)
    sec_str = " ".join(sec_matches)

    full_subquery = f"{sec_str} {entity_str} {crime_sub_type} {extracted_context}".strip()
    return full_subquery

def inspect_queries():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_tc = [tc for tc in data['test_cases'] if tc['test_case_id'] == 'BENCH-COMPOSITE-001'][0]
    synth = composite_tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    entities = composite_tc.get("expected_entities", {})

    print(f"=========================================================================")
    print(f"[*] BENCH-COMPOSITE-001 NARRATIVE:")
    print(f"\"{narrative}\"\n")
    print(f"=========================================================================")

    print(f"--- DYNAMIC SUB-QUERIES GENERATED PER SPECIALIST (NO ACT-NAME BOILERPLATE) ---")
    for tgt in composite_tc["ground_truth_targets"]:
        spec = tgt["target_specialist"]
        subq = extract_dynamic_narrative_subquery(narrative, target_specialist=spec, crime_sub_type=crime_sub, entities=entities)
        print(f"\n[SPECIALIST: {spec}]")
        print(f"  Target Document needed: {tgt['source_document']} (Page {tgt['page_number']})")
        print(f"  Generated Sub-Query:  \"{subq}\"")

if __name__ == "__main__":
    inspect_queries()
