from app.agents.state import AgentState
import re

def evaluator_node(state: AgentState) -> dict:
    """
    Evaluator Node (Anti-Laziness & Safety Filter).
    Inspects draft outputs from all specialist agents to ensure complete legal grounding,
    mandatory BNSS/BSA compliance, and actionable police directives.
    Includes a DETERMINISTIC GROUNDING VALIDATOR to strip ungrounded/phantom entities 
    and prevent victim account freezing.
    """
    bns_draft = state.get('bns_draft') or {}
    bsa_draft = state.get('bsa_draft') or {}
    cyber_draft = state.get('cyber_draft') or {}
    conv_draft = state.get('conventional_draft') or {}
    iteration = state.get('iteration_count') or 0
    entities = state.get('entities') or {}
    
    feedback = []
    
    # ---------------------------------------------------------
    # DETERMINISTIC GROUNDING VALIDATOR & SAFETY GUARDRAIL
    # ---------------------------------------------------------
    allowed_phones = set(entities.get('phone_numbers', []))
    allowed_handles = {h.lower() for h in entities.get('online_handles', [])}
    
    allowed_banks = set()
    victim_banks = set()
    for b in entities.get('bank_accounts', []):
        acc = str(b.get('account_number', ''))
        if not acc: continue
        allowed_banks.add(acc)
        if b.get('is_victim_account') or str(b.get('account_role', '')).lower() in ['victim', 'complainant']:
            victim_banks.add(acc)
            
    if cyber_draft and 'digital_directives' in cyber_draft:
        safe_directives = []
        for d in cyber_draft['digital_directives']:
            desc_raw = (d.get('description') or '') + " " + (d.get('title') or '')
            desc_lower = desc_raw.lower()
            
            # Check 1: Victim Account Freeze Safety Violation
            is_victim_violation = False
            for vb in victim_banks:
                if vb in desc_raw and any(word in desc_lower for word in ['freeze', 'lien', 'block', 'suspend', 'hold']):
                    is_victim_violation = True
                    break
            
            if is_victim_violation:
                print(f"[!] Evaluator stripped directive due to VICTIM FREEZE safety violation: {d.get('title')}")
                continue
                
            # Check 2: Phantom/Hallucinated Entity Violation
            # If the directive mentions ANY 9+ digit number or handle, it MUST be in the allowed list.
            numbers = re.findall(r'\b\d{9,18}\b', desc_raw)
            handles = re.findall(r'@[a-zA-Z0-9_]{3,}', desc_raw)
            
            is_hallucination = False
            for num in numbers:
                # Often notice templates include Sec 106 or 94, those are small numbers. 
                # 9+ digits are usually phones or bank accounts.
                if num not in allowed_phones and num not in allowed_banks:
                    is_hallucination = True
                    break
                    
            for h in handles:
                if h.lower() not in allowed_handles:
                    is_hallucination = True
                    break
                    
            if is_hallucination:
                print(f"[!] Evaluator stripped directive due to HALLUCINATION/UNGROUNDED entity: {d.get('title')}")
                continue
                
            safe_directives.append(d)
            
        cyber_draft['digital_directives'] = safe_directives
        
        # Scrub recommended_legal_requests as well
        if 'recommended_legal_requests' in cyber_draft:
            safe_reqs = []
            for r in cyber_draft['recommended_legal_requests']:
                desc_raw = (r.get('purpose') or '') + " " + (r.get('target_provider') or '')
                desc_lower = desc_raw.lower()
                
                is_victim_violation = False
                for vb in victim_banks:
                    if vb in desc_raw and any(w in desc_lower for w in ['freeze', 'lien', 'block', 'suspend', 'hold']):
                        is_victim_violation = True
                        break
                        
                if is_victim_violation:
                    print(f"[!] Evaluator stripped legal request due to VICTIM FREEZE violation.")
                    continue
                    
                numbers = re.findall(r'\b\d{9,18}\b', desc_raw)
                handles = re.findall(r'@[a-zA-Z0-9_]{3,}', desc_raw)
                
                is_hallucination = False
                for num in numbers:
                    if num not in allowed_phones and num not in allowed_banks:
                        is_hallucination = True
                        break
                for h in handles:
                    if h.lower() not in allowed_handles:
                        is_hallucination = True
                        break
                        
                if is_hallucination:
                    print(f"[!] Evaluator stripped legal request due to HALLUCINATION/UNGROUNDED entity.")
                    continue
                    
                safe_reqs.append(r)
            cyber_draft['recommended_legal_requests'] = safe_reqs
    # ---------------------------------------------------------

    # Check 1: Check BNS grounding
    if not bns_draft.get('bns_sections'):
        feedback.append("Missing explicit statutory penal section grounding.")
        
    # Check 2: Check BSA evidence compliance (digital or physical)
    if not bsa_draft.get('bsa_requirements') and not bsa_draft.get('mandatory_checklists'):
        feedback.append("Missing mandatory evidence collection checklist.")

    # Check 3: Check actionability of specialist drafts
    has_cyber_directives = bool(cyber_draft.get('digital_directives'))
    has_field_steps = bool(conv_draft.get('field_steps'))
    
    if not has_cyber_directives and not has_field_steps:
        feedback.append("Missing actionable investigation directives for investigating officers.")

    state_update = {
        "cyber_draft": cyber_draft,
        "iteration_count": iteration + 1
    }

    # Anti-laziness loop limit
    if feedback and iteration < 2:
        print(f"[!] Evaluator REJECTED drafts (Iteration {iteration + 1}): {feedback}")
        state_update["evaluation_status"] = "REJECTED"
        state_update["evaluation_feedback"] = feedback
    else:
        print(f"[+] Evaluator APPROVED drafts! Passing to HITL review.")
        state_update["evaluation_status"] = "APPROVED"
        state_update["evaluation_feedback"] = []

    return state_update
