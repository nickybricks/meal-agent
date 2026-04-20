"""
config.py — Static configuration for all supported models and app defaults.

Defines:
- CLOUD_MODELS: dict mapping model name -> provider + display metadata
- LOCAL_MODELS: list of known Ollama model names
- DEFAULT_MODEL: fallback model when none is specified
- DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_TOP_P: LLM parameter defaults
- PERSONALITY_PROMPTS: dict mapping personality key -> system prompt prefix
- THEMEALDB_BASE_URL: base URL for TheMealDB API calls

Nothing here makes network calls — pure constants.
"""

THEMEALDB_BASE_URL = "https://themealdb.com/api/json/v1/1"

DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 1024
DEFAULT_TOP_P = 1.0

CLOUD_MODELS = {
    "gpt-4o-mini":        {"provider": "openai",    "display": "GPT-4o Mini"},
    "gpt-4o":             {"provider": "openai",    "display": "GPT-4o"},
    "claude-3-5-haiku":   {"provider": "anthropic", "display": "Claude 3.5 Haiku"},
    "claude-3-5-sonnet":  {"provider": "anthropic", "display": "Claude 3.5 Sonnet"},
    "gemini-2.0-flash":   {"provider": "google",    "display": "Gemini 2.0 Flash"},
    "gemini-1.5-pro":     {"provider": "google",    "display": "Gemini 1.5 Pro"},
}

LOCAL_MODELS = [
    "llama3.2:3b",
    "llama3.2:8b",
    "mistral:7b",
    "gemma3:4b",
    "phi4:14b",
    "deepseek-r1:8b",
    "qwen2.5:7b",
]

PERSONALITY_PROMPTS = {
    "friendly":      "You are a warm, enthusiastic personal chef who loves sharing recipes.",
    "professional":  "You are a professional culinary advisor. Be precise and informative.",
    "concise":       "You are a concise recipe assistant. Keep responses brief and to the point.",
}
