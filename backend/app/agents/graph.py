"""
LangGraph assembly for NARI's multi-agent system.

This directly implements the flow GGSIPU2617_Vitalis_Features_and_
Recommended_Architecture.pdf recommends ("Use an orchestrator/state graph
to route tasks, maintain context, call tools, validate outputs, and
combine specialist-agent results" - section 6) and follows the handoff
shape in MAS - Agent Handoffs:

    entry -> Emergency check (always first; bypasses everything else if
              a red flag/crisis fires - SRAI - Safety Framework)
           -> Router (picks ONE specialist agent)
           -> Clinical Knowledge / RAG (evidence for the chosen domain)
           -> the chosen specialist agent
           -> Risk Prediction (heuristic pattern flag, only fires for
              domains with a defined rule - see risk_engine.py)
           -> Care Plan (combines everything into an explainable card)
           -> Follow-up Care (schedules continuity check-ins when useful)
           -> END

Compared to the Vitalis/Aarogya baseline's conversation_agent.py (a single
LLM call asked to both pick an agent AND draft the whole reply in one
shot, with no evidence, no risk layer, and no persisted trail) this is a
real graph: each stage is independently inspectable, contributes to
`event_log`, and non-LLM safety logic runs deterministically before any
generative step.
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents import nodes
from app.agents.state import GraphState


def build_graph():
    graph = StateGraph(GraphState)

    graph.add_node("emergency_check", nodes.node_emergency_check)
    graph.add_node("router", nodes.node_router)
    graph.add_node("rag", nodes.node_rag)
    for agent_name, fn in nodes._SPECIALIST_NODES.items():
        # Several agent names can map to the same underlying function
        # (e.g. Risk Prediction intake reuses the Symptom node); LangGraph
        # nodes must have unique names, so we key by agent name here and
        # dispatch by that same name in the conditional edge below.
        graph.add_node(agent_name, fn)
    graph.add_node("risk_check", nodes.node_risk_check)
    graph.add_node("careplan", nodes.node_careplan)
    graph.add_node("followup", nodes.node_followup)

    graph.set_entry_point("emergency_check")

    graph.add_conditional_edges(
        "emergency_check",
        lambda s: "end" if s.get("urgent") else "continue",
        {"end": END, "continue": "router"},
    )
    graph.add_edge("router", "rag")
    graph.add_conditional_edges("rag", nodes.dispatch_specialist, {name: name for name in nodes._SPECIALIST_NODES})
    for agent_name in nodes._SPECIALIST_NODES:
        graph.add_edge(agent_name, "risk_check")
    graph.add_edge("risk_check", "careplan")
    graph.add_edge("careplan", "followup")
    graph.add_edge("followup", END)

    return graph.compile()


_COMPILED_GRAPH = None


def get_graph():
    global _COMPILED_GRAPH
    if _COMPILED_GRAPH is None:
        _COMPILED_GRAPH = build_graph()
    return _COMPILED_GRAPH


def run_turn(
    *,
    message: str,
    patient_id: str | None = None,
    history: list[dict[str, str]] | None = None,
    profile: dict | None = None,
    structured_context: dict | None = None,
) -> GraphState:
    """Synchronous entry point (agent nodes are all sync/CPU-bound or make
    blocking HTTP calls) - callers from async API routes should run this
    via asyncio.to_thread, matching how conversation_agent.get_agent_reply
    is already invoked from api/chat.py."""
    initial_state: GraphState = {
        "patient_id": patient_id,
        "message": message,
        "history": history or [],
        "profile": profile,
        "structured_context": structured_context or {},
        "event_log": [],
    }
    graph = get_graph()
    result = graph.invoke(initial_state)
    return result