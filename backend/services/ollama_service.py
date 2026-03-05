"""
Thin async wrapper around the Ollama HTTP API.
"""

import json
from typing import AsyncIterator, List

import httpx

from config import OLLAMA_BASE_URL, OLLAMA_MODEL


async def chat(messages: List[dict], stream: bool = True) -> AsyncIterator[str]:
    """
    Send a chat-completion request to Ollama and yield content chunks.
    Each *messages* entry: {"role": "system"|"user"|"assistant", "content": "…"}
    """
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": stream,
        "options": {"temperature": 0.2},
    }
    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=120) as client:
        async with client.stream("POST", "/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                chunk = data.get("message", {}).get("content", "")
                if chunk:
                    yield chunk
                if data.get("done"):
                    return


async def complete(prompt: str, max_tokens: int = 256) -> str:
    """
    Send a raw /api/generate request for inline code completion (FIM).
    Returns the generated text in one shot (no streaming needed for ghost text).
    """
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": max_tokens,
            "stop": ["\n\n", "```"],
        },
    }
    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=60) as client:
        resp = await client.post("/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "")
