"""
Crime OS AI — Concept-Based Multi-Query Decomposition + HyDE Engine v4

KEY DESIGN PRINCIPLE:
  The LLM's training data contains OLD Indian laws (IPC, CrPC, Evidence Act) which have
  been REPLACED by new statutes (BNS 2023, BNSS 2023, BSA 2023). Asking the LLM to cite
  specific section numbers causes it to hallucinate old-law references (e.g., "Section 506 IPC")
  that create noise against the vector database which contains ONLY new-law text.

  SOLUTION: Use the LLM ONLY for what it's good at — understanding the complaint narrative
  and extracting LEGAL CONCEPTS (e.g., "cheating", "criminal intimidation", "electronic evidence").
  Then construct search queries using those concepts combined with the ACTUAL document names
  from our database. The LLM never needs to know specific section numbers.

Approach:
  1. LLM extracts 3-4 distinct legal concepts/aspects from the complaint
  2. For each concept, we build a search query using concept + actual DB document names
  3. HyDE passages describe the concept in formal legal language WITHOUT citing section numbers
  4. Rule-based fallback if LLM is unavailable
"""

import json
import re
import threading
from typing import List, Dict, Any, Optional
from config import get_agent_llm, ENABLE_DEMO_FALLBACKS

_decomposer_llm = None
_decomposer_lock = threading.Lock()

# Exact document names in the Qdrant vector database
DB_DOCUMENTS = {
    "penal": "BNS_Penal_Code_2024.pdf",
    "procedure": "BNSS_Procedural_Code_2023.pdf",
    "evidence": "BSA_Evidence_Act_2023.pdf",
    "it_act": "IT_Act_2000.pdf",
    "cyber_sop": "I4C_CFCFRMS_Financial_Fraud_SOP.pdf",
    "crypto_sop": "BPRD_Cryptocurrency_Investigation_SOP.pdf",
    "first_responder": "BPRD_First_Responder_Handbook_Computer_System_Acquisition.pdf",
    "eow_faq": "101_FAQS_EOW_INVESTIGATIONS.pdf",
    "telecom": "Telecommunications_Act_2023.pdf",
    "dpdp": "DPDP_Act_2023.pdf",
    "rbi_kyc": "RBI_Master_Direction_KYC.pdf",
    "rbi_liability": "RBI_Customer_Liability_Circular_2017.pdf",
    "missing_child": "MISSING_CHILD_SOP.pdf",
    "rape_sop": "SOP_Investigation_Prosecution_Rape_Women.pdf",
    "guj_manual": "THE_GUJARAT_POLICE_MANUAL.pdf",
    "guj_act": "The_Gujarat_Police_Act_1951.pdf",
    "police_training": "SOP_Ranking_Police_Training_Institutes.pdf",
}

def _get_decomposer_llm():
    """Thread-safe singleton LLM for query decomposition."""
    global _decomposer_llm
    if _decomposer_llm is None:
        with _decomposer_lock:
            if _decomposer_llm is None:
                _decomposer_llm = get_agent_llm("auto", temperature=0.1)
    return _decomposer_llm


def decompose_complaint_to_legal_queries(
    complaint_text: str,
    crime_sub_type: str = "",
    crime_category: str = "",
    entities: Optional[Dict[str, Any]] = None,
    specialist_domain: str = "",
    max_queries: int = 4
) -> List[Dict[str, str]]:
    """
    Decomposes a victim complaint into multiple concept-based search queries.

    The LLM extracts legal concepts ONLY — it does NOT generate section numbers
    or cite specific laws (because its training data has old/wrong section numbers).

    Returns a list of dicts with: "query", "hyde_passage", "intent"
    """
    if not complaint_text or len(complaint_text.strip()) < 10:
        return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

    prompt = f"""You are a legal concept extraction assistant. Your ONLY job is to identify the distinct legal concepts present in a police complaint.

COMPLAINT:
{complaint_text[:1200]}

CRIME TYPE: {crime_sub_type or 'Unknown'}
CATEGORY: {crime_category or 'Unknown'}

TASK: Extract exactly {max_queries} distinct legal concepts from this complaint. Each concept should be a different legal aspect that an investigator would need to look up.

RULES:
- Extract CONCEPTS like "cheating", "criminal intimidation", "electronic evidence", "search and seizure", "financial fraud investigation procedure"
- DO NOT cite any specific law names like IPC, CrPC, Evidence Act, BNS, BNSS, or BSA
- DO NOT generate any section numbers
- Focus on WHAT happened (the offence/procedure), not which law covers it
- Each concept must be different from the others
- Write a brief description (2-3 sentences) of what legal text about this concept would contain

Respond ONLY in valid JSON:
{{
  "concepts": [
    {{
      "concept": "<LEGAL_CONCEPT_NAME_eg_cheating_by_impersonation>",
      "description": "<2_3_SENTENCES_DESCRIBING_WHAT_THE_LEGAL_TEXT_ABOUT_THIS_CONCEPT_WOULD_SAY>",
      "aspect": "<ONE_OF: substantive_offence | investigation_procedure | evidence_rules | sop_steps>"
    }}
  ]
}}"""

    try:
        llm = _get_decomposer_llm()
        resp = llm.invoke(prompt)
        text = resp.content if hasattr(resp, 'content') else str(resp)

        # Parse JSON response — handle markdown code fences
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            data = json.loads(text.strip())
        except json.JSONDecodeError:
            try:
                from json_repair import repair_json
                repaired = repair_json(text.strip(), return_objects=True)
                data = repaired if isinstance(repaired, dict) else {"concepts": repaired}
            except Exception:
                return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

        concepts = data.get("concepts", [])
        if not concepts or not isinstance(concepts, list):
            return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

        # Convert LLM concepts into actual search queries using DB document names
        validated = []
        for c in concepts[:max_queries]:
            if not isinstance(c, dict) or not c.get("concept"):
                continue

            concept = str(c["concept"])
            description = str(c.get("description", concept))
            aspect = str(c.get("aspect", "substantive_offence")).lower()

            # Build the search query: concept + relevant document names from our DB
            query, hyde = _build_query_from_concept(concept, description, aspect, crime_sub_type, crime_category)

            # Strip any hallucinated old-law references from the query and hyde passage
            query = _sanitize_old_law_references(query)
            hyde = _sanitize_old_law_references(hyde)

            validated.append({
                "query": query,
                "hyde_passage": hyde,
                "intent": concept
            })

        if not validated:
            return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

        print(f"[+] Query Decomposer: Generated {len(validated)} concept-based sub-queries.")
        for i, q in enumerate(validated, 1):
            print(f"    [{i}] {q['intent']}: {q['query'][:100]}...")

        return validated

    except Exception as e:
        print(f"[-] Query Decomposer LLM Exception: {e}")
        return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)


def _sanitize_old_law_references(text: str) -> str:
    """
    Remove hallucinated old Indian law references that create noise.
    Strips IPC/CrPC/Evidence Act section numbers but keeps the legal concepts.
    """
    # Remove "Section XXX IPC", "Section XXX CrPC", "Section XXX of the Indian Evidence Act" etc.
    text = re.sub(r'\bSection\s+\d+[A-Z]?\s*(?:of\s+(?:the\s+)?)?(?:IPC|Indian Penal Code)\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bSection\s+\d+[A-Z]?\s*(?:of\s+(?:the\s+)?)?(?:CrPC|Cr\.P\.C\.|Code of Criminal Procedure)\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bSection\s+\d+[A-Z]?\s*(?:of\s+(?:the\s+)?)?(?:Indian Evidence Act|Evidence Act)\b', '', text, flags=re.IGNORECASE)
    # Remove standalone "IPC", "CrPC", "Indian Penal Code" mentions
    text = re.sub(r'\b(?:IPC|Indian Penal Code|CrPC|Cr\.P\.C\.|Code of Criminal Procedure|Indian Evidence Act)\b', '', text, flags=re.IGNORECASE)
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _build_query_from_concept(
    concept: str,
    description: str,
    aspect: str,
    crime_sub_type: str,
    crime_category: str
) -> tuple:
    """
    Converts a legal concept into a concrete search query + HyDE passage,
    using the ACTUAL document names from our Qdrant database.
    """
    concept_lower = concept.lower()
    crime_lower = (crime_sub_type or "").lower()
    cat_lower = (crime_category or "").lower()

    # Determine which documents are most relevant for this concept's aspect
    if aspect == "substantive_offence":
        # Penal code offences → BNS or IT Act
        if any(kw in concept_lower or kw in crime_lower for kw in ["cyber", "computer", "hacking", "identity", "phishing", "online", "digital"]):
            doc_context = "Information Technology Act 2000 punishment offence computer resource"
        else:
            doc_context = "Bharatiya Nyaya Sanhita BNS 2023 offence punishment imprisonment fine"

        query = f"{concept} {crime_sub_type} {doc_context}".strip()
        hyde = f"Whoever commits {concept} shall be punished with imprisonment for a term which may extend to years, or with fine, or with both. {description}"

    elif aspect == "investigation_procedure":
        if any(kw in concept_lower or kw in crime_lower for kw in ["cyber", "financial", "fraud", "upi", "bank", "online", "debit"]):
            doc_context = "CFCFRMS 1930 portal financial fraud SOP investigation cyber"
        elif any(kw in concept_lower for kw in ["crypto", "bitcoin", "blockchain", "wallet"]):
            doc_context = "BPRD cryptocurrency investigation SOP blockchain wallet"
        elif any(kw in concept_lower for kw in ["missing", "child", "minor"]):
            doc_context = "missing child SOP TrackChild"
        elif any(kw in concept_lower for kw in ["rape", "sexual", "assault", "women"]):
            doc_context = "SOP investigation prosecution rape women"
        else:
            doc_context = "Bharatiya Nagarik Suraksha Sanhita BNSS 2023 investigation procedure"

        query = f"{concept} {crime_sub_type} {doc_context}".strip()
        hyde = f"The investigating officer shall {description} as per the prescribed procedure for cases involving {concept}."

    elif aspect == "evidence_rules":
        if any(kw in concept_lower for kw in ["electronic", "digital", "computer", "hash", "certificate"]):
            doc_context = "Bharatiya Sakshya Adhiniyam BSA 2023 electronic record evidence certificate admissibility"
        elif any(kw in concept_lower for kw in ["forensic", "computer", "acquisition", "seizure"]):
            doc_context = "BPRD first responder handbook computer system acquisition digital forensics"
        else:
            doc_context = "Bharatiya Sakshya Adhiniyam BSA 2023 evidence admissibility relevant fact"

        query = f"{concept} {doc_context}".strip()
        hyde = f"Any information contained in an electronic record which is relevant to {concept} shall be admissible in evidence. {description}"

    elif aspect == "sop_steps":
        if any(kw in concept_lower or kw in crime_lower for kw in ["cyber", "financial", "fraud", "upi", "bank"]):
            doc_context = "CFCFRMS 1930 portal debit freeze mule account SOP"
        elif any(kw in concept_lower for kw in ["police", "manual", "duty", "patrol", "station"]):
            doc_context = "Gujarat Police Manual procedure duty"
        elif any(kw in concept_lower for kw in ["training", "ranking", "institute"]):
            doc_context = "SOP ranking police training institutes"
        else:
            doc_context = "Bharatiya Nagarik Suraksha Sanhita BNSS 2023 procedure"

        query = f"{concept} {crime_sub_type} {doc_context}".strip()
        hyde = f"Standard operating procedure for {concept}: {description}"

    else:
        # Generic fallback
        doc_context = f"Bharatiya Nyaya Sanhita BNS BNSS BSA 2023 {crime_sub_type}"
        query = f"{concept} {doc_context}".strip()
        hyde = f"{description} This provision applies to cases involving {concept}."

    return query, hyde


def _fallback_decomposition(
    complaint_text: str,
    crime_sub_type: str = "",
    crime_category: str = ""
) -> List[Dict[str, str]]:
    """
    Rule-based fallback decomposition when LLM is unavailable.
    Uses concept keywords + actual DB document names. Never cites specific section numbers.
    """
    crime_sub_lower = (crime_sub_type or "").lower()
    complaint_lower = (complaint_text or "").lower()

    queries = []

    # Query 1: Substantive offence (penal code)
    if any(kw in crime_sub_lower or kw in complaint_lower for kw in ["cheat", "fraud", "impersonat", "deceiv"]):
        concept = "cheating dishonestly inducing delivery of property impersonation"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["extort", "threat", "blackmail", "sextort", "intimidat"]):
        concept = "extortion criminal intimidation threatening coercion"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["theft", "robbery", "stolen", "snatch"]):
        concept = "theft robbery criminal misappropriation of property"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["forgery", "counterfeit", "fake document"]):
        concept = "forgery making false document counterfeiting"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["murder", "homicide", "death", "kill"]):
        concept = "murder culpable homicide causing death"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["assault", "hurt", "grievous", "injury"]):
        concept = "voluntarily causing hurt grievous hurt assault"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["kidnap", "abduct", "missing"]):
        concept = "kidnapping abduction wrongful confinement"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["trespass", "house", "break"]):
        concept = "criminal trespass house-breaking burglary"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["mischief", "damage", "destroy", "vandal"]):
        concept = "mischief damage to property"
    else:
        concept = f"offence punishment {crime_sub_type}"

    # Choose document context based on crime category
    if any(kw in crime_sub_lower or kw in complaint_lower for kw in ["cyber", "online", "computer", "hacking", "phishing", "identity theft"]):
        doc_ref = "Information Technology Act 2000 punishment offence computer resource"
    else:
        doc_ref = "Bharatiya Nyaya Sanhita BNS 2023 offence punishment imprisonment"

    queries.append({
        "query": f"{concept} {crime_sub_type} {doc_ref}".strip(),
        "hyde_passage": f"Whoever commits {concept} shall be punished with imprisonment for a term which may extend to years, or with fine, or with both. This section applies to cases involving {crime_sub_type}.",
        "intent": f"substantive_offence: {concept[:50]}"
    })

    # Query 2: Investigation procedure / SOP
    if any(kw in crime_sub_lower or kw in complaint_lower for kw in ["cyber", "online", "upi", "digital", "internet", "telegram", "whatsapp", "fraud", "bank"]):
        queries.append({
            "query": f"CFCFRMS 1930 portal cyber fraud SOP debit freeze mule account investigation procedure {crime_sub_type}",
            "hyde_passage": f"The Citizen Financial Cyber Fraud Reporting and Management System operates through the 1930 helpline portal. Upon receiving a complaint of financial cyber fraud, the investigating officer shall immediately initiate a debit freeze request on the suspected mule accounts.",
            "intent": "investigation_procedure: cyber_fraud_SOP"
        })
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["missing", "child", "minor", "pocso"]):
        queries.append({
            "query": f"missing child SOP TrackChild investigation procedure {crime_sub_type}",
            "hyde_passage": "Upon receiving information about a missing child, the police officer shall immediately register a case and upload the details on the TrackChild portal. The investigation shall be conducted on priority basis.",
            "intent": "investigation_procedure: missing_child_SOP"
        })
    else:
        queries.append({
            "query": f"Bharatiya Nagarik Suraksha Sanhita BNSS 2023 investigation procedure panchnama search seizure {crime_sub_type}",
            "hyde_passage": f"The investigating officer shall conduct a search and seizure at the place of occurrence in the presence of two independent witnesses and prepare a panchnama documenting all material evidence recovered during the investigation of {crime_sub_type}.",
            "intent": "investigation_procedure: BNSS_procedure"
        })

    # Query 3: Evidence requirements
    if any(kw in crime_sub_lower or kw in complaint_lower for kw in ["cyber", "online", "digital", "electronic", "computer", "upi", "phone"]):
        queries.append({
            "query": f"Bharatiya Sakshya Adhiniyam BSA 2023 electronic record evidence certificate admissibility hash value chain of custody",
            "hyde_passage": "Any information contained in an electronic record which is printed on paper or stored or recorded or copied on optical or magnetic media shall be deemed to be a document and shall be admissible in evidence, provided it is accompanied by a certificate.",
            "intent": "evidence_rules: electronic_evidence"
        })
    else:
        queries.append({
            "query": f"Bharatiya Sakshya Adhiniyam BSA 2023 evidence admissibility relevant fact oral documentary {crime_sub_type}",
            "hyde_passage": f"Facts which are relevant to the issue in cases of {crime_sub_type} shall be proved by oral evidence or documentary evidence as prescribed under this Act.",
            "intent": "evidence_rules: general_evidence"
        })

    print(f"[+] Query Decomposer (Fallback): Generated {len(queries)} concept-based sub-queries.")
    return queries
