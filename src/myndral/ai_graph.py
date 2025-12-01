"""LangChain/LangGraph powered narrative helpers."""

from __future__ import annotations

from typing import TypedDict

from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, StateGraph


class NarrativeState(TypedDict, total=False):
    """State that flows through the LangGraph pipeline."""

    player_event: str
    narrative: str


class NarrativeGraph:
    """Tiny helper around a LangGraph to synthesize storytelling beats."""

    def __init__(self) -> None:
        self._prompt = PromptTemplate.from_template(
            """
            You are the narrative engine for a cozy exploration game. Given the
            following player event, respond with a short, atmospheric sentence that
            could appear in a logbook.

            Player event: {player_event}
            """.strip()
        )
        self._model = RunnableLambda(self._stub_llm)

        graph = StateGraph(NarrativeState)
        graph.add_node("narrate", self._narrate)
        graph.set_entry_point("narrate")
        graph.add_edge("narrate", END)
        self._app = graph.compile()

    def _stub_llm(self, prompt: str) -> str:
        """Deterministic stand-in for an actual LLM call."""

        event = prompt.split("Player event:")[-1].strip()
        if not event:
            return "The world hums softly, awaiting your first move."
        return f"{event.capitalize()} inspires a gentle whisper through the ruins.""

    def _narrate(self, state: NarrativeState) -> NarrativeState:
        prompt = self._prompt.format(player_event=state.get("player_event", ""))
        narrative = self._model.invoke(prompt)
        return {"narrative": narrative}

    def describe_event(self, player_event: str) -> str:
        """Run the LangGraph pipeline and return a single descriptive sentence."""

        result = self._app.invoke({"player_event": player_event})
        return result["narrative"]
