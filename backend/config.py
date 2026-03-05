"""
Central configuration – all tunables in one place.
"""

import os

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
WORKSPACE_DIR   = os.getenv("WORKSPACE_DIR", "/app/workspace")
FRONTEND_DIR    = os.getenv("FRONTEND_DIR", "/app/frontend")

# Context-window budget (characters). Qwen-2.5-Coder-7B supports 32 768 tokens;
# we stay well within the limit with ~24 000 characters (~6 000 tokens).
MAX_CONTEXT_CHARS = 24_000
