"""
Context-window builder – assembles the right amount of project
context for each AI request without blowing the token budget.
"""

from pathlib import Path
from typing import List

from config import WORKSPACE_DIR, MAX_CONTEXT_CHARS
from services import file_service


# File extensions we can meaningfully show to the model
_TEXT_EXTS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss",
    ".json", ".yaml", ".yml", ".toml", ".md", ".txt", ".sql",
    ".sh", ".bat", ".env", ".cfg", ".ini", ".xml", ".csv",
    ".java", ".c", ".cpp", ".h", ".hpp", ".go", ".rs", ".rb",
    ".php", ".vue", ".svelte",
}


def _is_text(name: str) -> bool:
    return Path(name).suffix.lower() in _TEXT_EXTS


def build_project_context(current_file: str | None = None) -> str:
    """
    Return a compact string containing:
      1. ASCII directory tree
      2. The content of the currently open file (full)
      3. Closely related files (imports / references) trimmed to budget
    """
    parts: list[str] = []
    budget = MAX_CONTEXT_CHARS

    # 1) Directory tree
    tree_str = file_service.tree()
    header = f"### Project structure\n```\n{tree_str}\n```\n"
    parts.append(header)
    budget -= len(header)

    # 2) Current file (always include in full)
    if current_file:
        try:
            content = file_service.read_file(current_file)
            block = f"### Current file: {current_file}\n```\n{content}\n```\n"
            parts.append(block)
            budget -= len(block)
        except Exception:
            pass

    # 3) Related files
    related = _find_related(current_file) if current_file else []
    for rel in related:
        if budget <= 500:
            break
        try:
            content = file_service.read_file(rel)
            block = f"### Related file: {rel}\n```\n{content}\n```\n"
            if len(block) > budget:
                # Truncate to fit
                block = block[:budget - 20] + "\n… (truncated)\n```\n"
            parts.append(block)
            budget -= len(block)
        except Exception:
            pass

    return "\n".join(parts)


def _find_related(current_file: str) -> List[str]:
    """
    Heuristically find files imported/referenced by the current file.
    """
    try:
        content = file_service.read_file(current_file)
    except Exception:
        return []

    base = Path(WORKSPACE_DIR).resolve()
    related: list[str] = []

    # Walk workspace for all text files
    all_files: list[str] = []
    for p in base.rglob("*"):
        if p.is_file() and _is_text(p.name):
            all_files.append(str(p.relative_to(base)).replace("\\", "/"))

    # Simple heuristic: if ANY other file's name (without ext) appears in
    # the current file content, consider it related.
    cur_name = Path(current_file).stem
    for f in all_files:
        if f == current_file:
            continue
        stem = Path(f).stem
        if stem in content and stem != cur_name:
            related.append(f)

    return related[:6]  # cap to avoid blowing budget
