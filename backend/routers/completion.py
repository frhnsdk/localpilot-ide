"""
Inline completion router – powers Copilot-style ghost text.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from services import ollama_service

router = APIRouter(prefix="/api/complete", tags=["completion"])


class CompletionRequest(BaseModel):
    prefix: str          # code before the cursor
    suffix: str = ""     # code after the cursor
    language: str = ""   # e.g. "python", "javascript"
    file_path: str = ""


@router.post("")
async def complete(req: CompletionRequest):
    """Return a single inline completion suggestion."""
    prompt = _build_prompt(req.prefix, req.suffix, req.language, req.file_path)
    suggestion = await ollama_service.complete(prompt, max_tokens=256)
    # Clean up: strip markdown fences if the model wraps output
    suggestion = suggestion.strip()
    if suggestion.startswith("```"):
        lines = suggestion.split("\n")
        suggestion = "\n".join(lines[1:])
    if suggestion.endswith("```"):
        suggestion = suggestion[:-3].rstrip()
    return {"suggestion": suggestion}


def _build_prompt(prefix: str, suffix: str, lang: str, path: str) -> str:
    lang_hint = f" ({lang})" if lang else ""
    parts = [
        f"# File: {path}{lang_hint}" if path else "",
        "# Continue the code below. Only output the continuation, nothing else.",
        prefix,
    ]
    if suffix:
        parts.append(f"# Code after cursor:\n{suffix}")
    return "\n".join(filter(None, parts))
