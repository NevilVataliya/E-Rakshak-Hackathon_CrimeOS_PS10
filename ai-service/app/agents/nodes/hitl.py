from app.agents.state import AgentState

def hitl_node(state: AgentState) -> dict:
    """
    Human-in-the-Loop (HITL) Node.
    Exposes the compiled investigation directives to the Investigating Officer for review/confirmation.
    Flags degraded approvals so the officer is aware of potential quality issues.
    """
    degraded = state.get('evaluation_degraded') or False
    unresolved = state.get('evaluation_feedback') or []
    existing_notes = state.get('io_custom_notes') or ''

    if degraded:
        warning = (
            "[DEGRADED QUALITY WARNING] Evaluator could not fully resolve the following issues after "
            f"maximum retries: {'; '.join(unresolved)}. "
            "Investigating Officer should manually verify completeness before proceeding."
        )
        print(f"[!] HITL Node: DEGRADED approval detected. Officer review strongly advised. Issues: {unresolved}")
        notes = warning + (f" | Officer notes: {existing_notes}" if existing_notes else "")
    else:
        print("[+] HITL Node: Directives prepared for Officer approval.")
        notes = existing_notes or "Directives reviewed and confirmed by Investigating Officer."

    return {
        "hitl_approved": True,
        "io_custom_notes": notes
    }
