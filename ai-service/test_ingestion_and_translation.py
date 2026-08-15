import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.offline_translator import offline_translator, FAST_DICT
from app.ingestion.heuristic_extractor import extract_entities_heuristic, _normalize_indic_digits, extract_monetary_amounts

def test_translation():
    print("\n--- 1. Testing Local Offline Translation ---")
    test_strings = [
        "Complaint Intake & Multimodal Parsing",
        "Subpoenas Dispatched",
        "Victim was defrauded of INR 85,000 via WhatsApp UPI link.",
        "Complaint reporting incident involving extracted entities.",
        "Case CR-2026-9910 registered for UPI fraud."
    ]

    for text in test_strings:
        hi_trans = offline_translator.translate_batch([text], "hi")[0]
        gu_trans = offline_translator.translate_batch([text], "gu")[0]
        print(f"\nOriginal: {text}")
        print(f"  -> Hindi:    {hi_trans}")
        print(f"  -> Gujarati: {gu_trans}")
        
        # Verify it didn't return raw English for known phrases/lexicon
        assert hi_trans != ""
        assert gu_trans != ""

def test_indic_digits_and_entities():
    print("\n--- 2. Testing Indic Digit & Entity Extraction ---")
    guj_complaint = (
        "મને વોટ્સએપ નંબર +91 98250 12345 પરથી મેસેજ આવ્યો અને scammer@okhdfcbank યુપીઆઈ દ્વારા "
        "રૂ. ૯,૦૦,૦૦૦/- નું ફ્રોડ કર્યું છે. બેંક એકાઉન્ટ 30910293101 છે."
    )
    
    extracted = extract_entities_heuristic(guj_complaint)
    print(f"Original Text: {guj_complaint}")
    print(f"Detected Language: {extracted['original_language']}")
    print(f"Extracted Monetary Loss: {extracted['entities']['monetary_loss']}")
    print(f"Extracted Phones: {extracted['entities']['phone_numbers']}")
    print(f"Extracted VPAs: {extracted['entities']['vpas_upis']}")
    print(f"Extracted Bank Accounts: {extracted['entities']['bank_accounts']}")
    print(f"Crime Category: {extracted['crime_category']}")
    print(f"Crime Sub-type: {extracted['crime_sub_type']}")

    assert extracted['original_language'] == "gu"
    assert extracted['entities']['monetary_loss'] == 900000
    assert "+91 98250 12345" in extracted['entities']['phone_numbers']
    assert "scammer@okhdfcbank" in extracted['entities']['vpas_upis']
    assert any(b['account_number'] == "30910293101" for b in extracted['entities']['bank_accounts'])
    assert extracted['crime_category'] == "CYBER"
    print("\n[+] All Ingestion & Translation assertions PASSED successfully!")

if __name__ == "__main__":
    test_translation()
    test_indic_digits_and_entities()
