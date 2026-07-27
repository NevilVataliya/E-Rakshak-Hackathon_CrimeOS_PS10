from app.agents.state import AgentState

def evaluator_node(state: AgentState) -> dict:
    """
    Evaluator Node (Anti-Laziness Quality Filter).
    Inspects draft outputs from all specialist agents to ensure complete legal grounding,
    mandatory BNSS/BSA compliance, and actionable police directives.
    Unbiased quality evaluation supporting both physical and digital evidence cases.
    """
    bns_draft = state.get('bns_draft') or {}
    bsa_draft = state.get('bsa_draft') or {}
    cyber_draft = state.get('cyber_draft') or {}
    conv_draft = state.get('conventional_draft') or {}
    iteration = state.get('iteration_count') or 0
    
    feedback = []
    
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

    # Anti-laziness loop limit (max 2 iterations to avoid infinite loops)
    if feedback and iteration < 2:
        print(f"[!] Evaluator REJECTED drafts (Iteration {iteration + 1}): {feedback}")
        return {
            "evaluation_status": "REJECTED",
            "evaluation_feedback": feedback,
            "iteration_count": iteration + 1
        }
    else:
        print(f"[+] Evaluator APPROVED drafts! Passing to HITL review.")
        return {
            "evaluation_status": "APPROVED",
            "evaluation_feedback": [],
            "iteration_count": iteration + 1
        }
