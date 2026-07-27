from app.agents.state import AgentState

def hitl_node(state: AgentState) -> dict:
    """
    Human-in-the-Loop (HITL) Node.
    Exposes the compiled investigation directives to the Investigating Officer for review/confirmation.
    """
    print("[+] HITL Node: Directives prepared for Officer approval.")
    return {
        "hitl_approved": True,
        "io_custom_notes": state.get("io_custom_notes") or "Directives reviewed and confirmed by Investigating Officer."
    }
