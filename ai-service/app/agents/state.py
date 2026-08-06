from typing import TypedDict, List, Dict, Any, Optional

class AgentState(TypedDict):
    case_id: str
    case_number: str
    complaint_text: str
    translated_text: str
    original_language: str
    crime_category: str  # CYBER, CONVENTIONAL, HYBRID
    crime_sub_type: str
    entities: Dict[str, Any]
    
    # Active Specialist Pods
    active_specialists: List[str]
    
    # Cross-Case Memory Linkages
    cross_case_matches: List[Dict[str, Any]]
    
    # Specialist Draft Outputs
    bns_draft: Optional[Dict[str, Any]]
    bsa_draft: Optional[Dict[str, Any]]
    cyber_draft: Optional[Dict[str, Any]]
    conventional_draft: Optional[Dict[str, Any]]
    
    # Evaluator State (Anti-Laziness Loop)
    evaluation_status: str  # PENDING, REJECTED, APPROVED
    evaluation_feedback: List[str]
    evaluation_degraded: bool  # True when force-approved after hitting retry cap
    iteration_count: int
    
    # HITL Approval State
    hitl_approved: bool
    io_custom_notes: str
    
    # Final Synthesized Output
    master_fir_details: Dict[str, Any]
    investigation_steps: List[Dict[str, Any]]
    legal_requests_to_generate: List[Dict[str, Any]]
    summary: str
