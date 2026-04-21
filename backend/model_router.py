"""
model_router.py — Factory that returns the correct LangChain chat model instance.

Single source of truth for all LLM instantiation. Nothing else imports model classes directly.
"""

import os
import requests
from langchain_core.language_models import BaseChatModel
from config import CLOUD_MODELS, LOCAL_MODELS


def get_llm(
    model_name: str,
    temperature: float = 0.7,
    top_p: float = 1.0,
    max_tokens: int = 1024,
    api_key: str | None = None,
) -> BaseChatModel:
    if model_name in CLOUD_MODELS:
        provider = CLOUD_MODELS[model_name]["provider"]

        if provider == "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                api_key=api_key or os.environ.get("OPENAI_API_KEY"),
            )

        if provider == "anthropic":
            from langchain_anthropic import ChatAnthropic
            # Anthropic model IDs use the dated format
            anthropic_ids = {
                "claude-3-5-haiku":  "claude-3-5-haiku-20241022",
                "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
            }
            return ChatAnthropic(
                model=anthropic_ids.get(model_name, model_name),
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"),
            )

        if provider == "google":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=model_name,
                temperature=temperature,
                max_output_tokens=max_tokens,
                top_p=top_p,
                google_api_key=api_key or os.environ.get("GOOGLE_API_KEY"),
            )

        raise ValueError(f"Unknown provider: {provider}")

    if model_name in LOCAL_MODELS:
        from langchain_ollama import ChatOllama
        ollama_host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        return ChatOllama(
            model=model_name,
            base_url=ollama_host,
            temperature=temperature,
            num_predict=max_tokens,
        )

    raise ValueError(f"Unknown model: {model_name!r}")


def list_available_models() -> list[dict]:
    """Return cloud models + any Ollama models currently installed."""
    models = [
        {"id": name, "display": meta["display"], "provider": meta["provider"]}
        for name, meta in CLOUD_MODELS.items()
    ]

    ollama_host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    try:
        resp = requests.get(f"{ollama_host}/api/tags", timeout=2)
        if resp.ok:
            installed = {m["name"] for m in resp.json().get("models", [])}
            for name in LOCAL_MODELS:
                # Match exact name or name without tag (llama3.2:3b matches llama3.2:3b)
                if name in installed or any(t.startswith(name.split(":")[0]) for t in installed):
                    models.append({"id": name, "display": name, "provider": "ollama"})
    except Exception:
        pass  # Ollama not running — silently skip

    return models
