from app.agents.state import AgentState

def manager_router_node(state: AgentState) -> dict:
    """
    Manager Router Node.
    Inspects crime classification, extracted entities, and evaluator feedback,
    and dynamically activates the required Specialist Pods for parallel execution.
    Unbiased dynamic routing based on crime attributes and extracted entity footprint.
    """
    crime_cat = (state.get('crime_category') or '').upper()
    entities = state.get('entities') or {}
    feedback = state.get('evaluation_feedback', [])
    
    active = ["bns_specialist", "bsa_specialist"]
    
    has_digital = bool(entities.get('vpas_upis') or entities.get('bank_accounts') or entities.get('phone_numbers'))
    has_physical = bool(entities.get('crime_locations') or crime_cat == "CONVENTIONAL")
    
    if crime_cat in ["CYBER", "HYBRID"] or has_digital:
        active.append("cyber_specialist")
    if crime_cat in ["CONVENTIONAL", "HYBRID"] or has_physical or ("cyber_specialist" not in active):
        active.append("conventional_specialist")

    print(f"[+] Manager Router Node: Activating Specialist Pods concurrently -> {active}")
    if feedback:
        print(f"[!] Incorporating Evaluator Feedback into re-trigger: {feedback}")

    return {
        "active_specialists": active
    }
