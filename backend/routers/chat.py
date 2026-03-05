"""
AI chat router – streams responses & executes structured actions.
"""

import json
import re
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List

from services import ollama_service, file_service, context

router = APIRouter(prefix="/api/chat", tags=["chat"])


SYSTEM_PROMPT = """\
You are **LocalPilot**, an expert AI coding assistant embedded in a local IDE.
You help the user build, edit, debug, and explain code.

When you need to CREATE NEW files or MODIFY/FIX EXISTING files, you MUST emit
structured action blocks. This is how you write code to the filesystem.

To create a NEW file:
ACTION: create_file
PATH: path/to/file.ext
CONTENT:
```
<full file content>
```

To EDIT / FIX / MODIFY an EXISTING file (provide the COMPLETE updated content):
ACTION: edit_file
PATH: path/to/file.ext
CONTENT:
```
<complete updated file content with changes applied>
```

To delete a file:
ACTION: delete_file
PATH: path/to/file.ext

To create a folder:
ACTION: create_folder
PATH: path/to/folder

CRITICAL RULES:
1. When the user asks you to FIX, MODIFY, UPDATE, REFACTOR, or CHANGE existing
   code, you MUST use "ACTION: edit_file" with the COMPLETE updated file content.
2. ALWAYS provide the ENTIRE file content — never use placeholders like
   "// rest of code", "...", or "// unchanged".
3. You may emit MULTIPLE action blocks in one response.
4. Put action blocks FIRST, then a SHORT explanation of what you changed.
5. Do NOT repeat code outside of action blocks — keep explanation text brief.
6. When fixing a bug, re-read the existing file carefully and output the full
   corrected version.
"""


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    current_file: str | None = None


@router.post("")
async def chat(req: ChatRequest):
    """Stream an AI response, then execute any action blocks."""
    # Build context-enriched system message
    ctx = context.build_project_context(req.current_file)
    system_msg = SYSTEM_PROMPT + "\n\n" + ctx

    messages = [{"role": "system", "content": system_msg}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    collected: list[str] = []

    async def generate():
        async for chunk in ollama_service.chat(messages, stream=True):
            collected.append(chunk)
            yield f"data: {chunk}\n\n"
        # After streaming, execute action blocks
        full_text = "".join(collected)
        actions = _parse_actions(full_text)
        for a in actions:
            _execute(a)
            # Signal each file change to the frontend in real-time
            event = {"action": a["action"], "path": a["path"]}
            yield f"data: [FILE_ACTION]{json.dumps(event)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Action parser / executor ──────────────────────────────────

_ACTION_RE = re.compile(
    r"ACTION:\s*(create_file|edit_file|delete_file|create_folder)\s*\n"
    r"PATH:\s*(.+?)\s*\n"
    r"(?:CONTENT:\s*\n```[^\n]*\n([\s\S]*?)```)?",
    re.MULTILINE,
)


def _parse_actions(text: str) -> list[dict]:
    actions = []
    for m in _ACTION_RE.finditer(text):
        actions.append({
            "action": m.group(1),
            "path": m.group(2).strip(),
            "content": m.group(3) or "",
        })
    return actions


def _execute(action: dict):
    act = action["action"]
    path = action["path"]
    content = action["content"]
    if act in ("create_file", "edit_file"):
        file_service.write_file(path, content)
    elif act == "delete_file":
        file_service.delete_file(path)
    elif act == "create_folder":
        file_service.create_folder(path)
