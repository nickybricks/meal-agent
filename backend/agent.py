"""
agent.py — LangGraph stateful agent graph.

Graph: load_profile -> process_query -> (tools | direct) -> generate_response -> save_checkpoint -> END

Public API:
  build_graph()               — called once at startup, returns compiled graph
  run_graph(graph, input, config)    — thin async wrapper for /chat
  rewind_and_run(graph, ...)  — rewinds to checkpoint for /edit
"""

import json
import uuid
from typing import TypedDict, Annotated, Literal

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

import database
import memory as mem
from model_router import get_llm
from tools import get_tools


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    user_profile: dict
    model_name: str
    temperature: float
    top_p: float
    max_tokens: int
    personality: str
    enabled_tools: list[str]
    current_recipe: dict | None
    feedback_history: list[dict]
    last_checkpoint_id: str
    session_id: str


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def load_profile(state: AgentState) -> dict:
    user_id = state["user_id"]
    try:
        user = database.get_user(user_id) or {"id": user_id, "name": user_id}
        prefs = database.get_preferences(user_id)
        feedback = database.get_feedback_history(user_id, limit=20)
    except Exception:
        user = {"id": user_id, "name": user_id}
        prefs = {}
        feedback = []

    profile = {**user, **prefs}
    return {
        "user_profile": profile,
        "feedback_history": feedback,
    }


def process_query(state: AgentState) -> dict:
    """LLM call with tools bound. Decides tool use vs direct reply."""
    llm = get_llm(
        state["model_name"],
        temperature=state["temperature"],
        top_p=state.get("top_p", 1.0),
        max_tokens=state.get("max_tokens", 1024),
    )

    tools = get_tools(state.get("enabled_tools", []))

    system_prompt = mem.build_system_prompt(
        state.get("user_profile", {}),
        state.get("feedback_history", []),
        state.get("personality", "friendly"),
    )

    messages = [SystemMessage(content=system_prompt)] + list(state["messages"])

    try:
        if tools:
            llm_with_tools = llm.bind_tools(tools)
            response = llm_with_tools.invoke(messages)
        else:
            response = llm.invoke(messages)
    except Exception as e:
        response = AIMessage(
            content=f"Sorry, the model call failed ({e.__class__.__name__}). Please try again."
        )

    return {"messages": [response]}


def _should_use_tools(state: AgentState) -> Literal["execute_tools", "save_checkpoint"]:
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "execute_tools"
    return "save_checkpoint"


def generate_response(state: AgentState) -> dict:
    """Synthesise a final reply after tool execution."""
    llm = get_llm(
        state["model_name"],
        temperature=state["temperature"],
        top_p=state.get("top_p", 1.0),
        max_tokens=state.get("max_tokens", 1024),
    )

    system_prompt = mem.build_system_prompt(
        state.get("user_profile", {}),
        state.get("feedback_history", []),
        state.get("personality", "friendly"),
    )

    messages = [SystemMessage(content=system_prompt)] + list(state["messages"])
    try:
        response = llm.invoke(messages)
    except Exception as e:
        response = AIMessage(
            content=f"Sorry, I couldn't finish that response ({e.__class__.__name__})."
        )
    return {"messages": [response]}


def save_checkpoint_node(state: AgentState, config: RunnableConfig) -> dict:
    """Persist a checkpoint reference to Supabase."""
    checkpoint_id = (
        config.get("configurable", {}).get("checkpoint_id")
        or str(uuid.uuid4())
    )

    try:
        state_summary = json.dumps({
            "user_id": state.get("user_id"),
            "model_name": state.get("model_name"),
            "session_id": state.get("session_id"),
            "message_count": len(state.get("messages", [])),
        })
        database.save_checkpoint(
            checkpoint_id,
            state.get("user_id", ""),
            state.get("session_id", ""),
            state_summary,
        )
    except Exception:
        pass  # Non-fatal — checkpoint is still in MemorySaver

    return {"last_checkpoint_id": checkpoint_id}


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("load_profile", load_profile)
    builder.add_node("process_query", process_query)
    builder.add_node("execute_tools", ToolNode(tools=[
        *get_tools(["search_recipes", "get_user_profile", "save_preference",
                    "substitute_ingredient", "generate_meal_plan"])
    ]))
    builder.add_node("generate_response", generate_response)
    builder.add_node("save_checkpoint", save_checkpoint_node)

    builder.add_edge(START, "load_profile")
    builder.add_edge("load_profile", "process_query")
    builder.add_conditional_edges(
        "process_query",
        _should_use_tools,
        {"execute_tools": "execute_tools", "save_checkpoint": "save_checkpoint"},
    )
    builder.add_edge("execute_tools", "generate_response")
    builder.add_edge("generate_response", "save_checkpoint")
    builder.add_edge("save_checkpoint", END)

    checkpointer = MemorySaver()
    return builder.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Public wrappers
# ---------------------------------------------------------------------------

async def run_graph(graph, state_input: dict, config: dict) -> AgentState:
    result = await graph.ainvoke(state_input, config)
    # Overwrite last_checkpoint_id with the real LangGraph checkpoint ID so
    # /edit can find it in the thread history (the node-generated UUID isn't
    # the same identifier MemorySaver indexes by).
    try:
        snapshot = await graph.aget_state(config)
        real_id = snapshot.config.get("configurable", {}).get("checkpoint_id")
        if real_id:
            result = {**result, "last_checkpoint_id": real_id}
    except Exception:
        pass
    return result


async def rewind_and_run(
    graph,
    checkpoint_id: str,
    new_message: str,
    config: dict,
    overrides: dict | None = None,
) -> AgentState:
    """Fork from a historical checkpoint and re-run with an edited message.

    Walks the thread's checkpoint history (via aget_state_history) to find the
    snapshot whose checkpoint_id matches. Calling aupdate_state on that
    snapshot's config creates a new branch (fork), then ainvoke resumes from
    there. `overrides` lets callers swap the model/params for the re-run.
    """
    target = None
    async for snapshot in graph.aget_state_history(config):
        snap_cp = snapshot.config.get("configurable", {}).get("checkpoint_id")
        if snap_cp == checkpoint_id:
            target = snapshot
            break

    if target is None:
        raise ValueError(f"Checkpoint {checkpoint_id!r} not found in thread history.")

    # Replace the most recent HumanMessage by re-emitting one with the same id
    # (add_messages dedupes/replaces by id). If none found, append a new one.
    messages = list(target.values.get("messages", []))
    update: dict = {}
    replacement: HumanMessage | None = None
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], HumanMessage):
            replacement = HumanMessage(content=new_message, id=messages[i].id)
            break
    if replacement is None:
        replacement = HumanMessage(content=new_message)
    update["messages"] = [replacement]

    if overrides:
        for k, v in overrides.items():
            if v is not None:
                update[k] = v

    forked_config = await graph.aupdate_state(target.config, update)
    result = await graph.ainvoke(None, forked_config)
    return result
