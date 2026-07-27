from langgraph.graph import StateGraph, END
from app.agents.state import AgentState
from app.agents.nodes.cross_memory import cross_case_memory_node
from app.agents.nodes.manager_router import manager_router_node
from app.agents.specialists.bns_agent import bns_agent_node
from app.agents.specialists.bsa_agent import bsa_agent_node
from app.agents.specialists.cyber_agent import cyber_agent_node
from app.agents.specialists.conventional_agent import conventional_agent_node
from app.agents.nodes.evaluator import evaluator_node
from app.agents.nodes.hitl import hitl_node
from app.agents.nodes.synthesis import synthesis_node

def route_after_manager(state: AgentState) -> list:
    """
    Parallel Fan-Out Router:
    Returns the list of specialist node names to execute concurrently in parallel based on evidence.
    """
    active = state.get("active_specialists", ["bns_specialist", "bsa_specialist", "cyber_specialist"])
    return active

def route_after_evaluator(state: AgentState) -> str:
    """
    Anti-Laziness Evaluator Loop Router:
    If REJECTED (and under iteration limit), loops back to manager_router to re-trigger specialists with feedback.
    If APPROVED, proceeds to HITL Node.
    """
    status = state.get('evaluation_status', 'APPROVED')
    if status == "REJECTED":
        return "manager_router"
    return "hitl_node"

def build_investigation_graph():
    """
    Builds and compiles the Crime OS AI Agentic Investigation Graph.
    Features:
    1. Cross-Case Memory Linkage
    2. Dynamic Manager Router
    3. Parallel Fan-Out Execution of Specialist Pods
    4. Evaluator Anti-Laziness Feedback Loop
    5. HITL Review
    6. Master FIR & Turnkey PDF Synthesis
    """
    workflow = StateGraph(AgentState)

    # 1. Add Nodes
    workflow.add_node("cross_memory", cross_case_memory_node)
    workflow.add_node("manager_router", manager_router_node)
    workflow.add_node("bns_specialist", bns_agent_node)
    workflow.add_node("bsa_specialist", bsa_agent_node)
    workflow.add_node("cyber_specialist", cyber_agent_node)
    workflow.add_node("conventional_specialist", conventional_agent_node)
    workflow.add_node("evaluator", evaluator_node)
    workflow.add_node("hitl_node", hitl_node)
    workflow.add_node("synthesis", synthesis_node)

    # 2. Entry Point
    workflow.set_entry_point("cross_memory")

    # 3. Cross Memory -> Manager Router
    workflow.add_edge("cross_memory", "manager_router")

    # 4. Manager Router -> Parallel Fan-Out to Specialist Pods
    workflow.add_conditional_edges(
        "manager_router",
        route_after_manager,
        [
            "bns_specialist",
            "bsa_specialist",
            "cyber_specialist",
            "conventional_specialist"
        ]
    )

    # 5. Connect Specialist Pods to Evaluator Node
    workflow.add_edge("bns_specialist", "evaluator")
    workflow.add_edge("bsa_specialist", "evaluator")
    workflow.add_edge("cyber_specialist", "evaluator")
    workflow.add_edge("conventional_specialist", "evaluator")

    # 6. Evaluator -> Conditional Anti-Laziness Loop or HITL Node
    workflow.add_conditional_edges(
        "evaluator",
        route_after_evaluator,
        {
            "manager_router": "manager_router",
            "hitl_node": "hitl_node"
        }
    )

    # 7. HITL Node -> Synthesis -> END
    workflow.add_edge("hitl_node", "synthesis")
    workflow.add_edge("synthesis", END)

    return workflow.compile()

investigation_graph = build_investigation_graph()
