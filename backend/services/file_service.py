"""
Filesystem helper – every path is resolved relative to WORKSPACE_DIR
and never allowed to escape it.
"""

import os
import shutil
import zipfile
from io import BytesIO
from pathlib import Path
from typing import List

from config import WORKSPACE_DIR


def _safe(rel: str) -> Path:
    """Resolve *rel* inside the workspace; raise on escape attempts."""
    base = Path(WORKSPACE_DIR).resolve()
    target = (base / rel).resolve()
    if not str(target).startswith(str(base)):
        raise PermissionError("Path escapes workspace")
    return target


# ── Directory listing ─────────────────────────────────────────

def list_directory(rel: str = "") -> List[dict]:
    """Return a flat list of {name, type, path} entries."""
    root = _safe(rel)
    if not root.is_dir():
        return []
    entries = []
    for item in sorted(root.iterdir()):
        entries.append({
            "name": item.name,
            "type": "folder" if item.is_dir() else "file",
            "path": str(item.relative_to(Path(WORKSPACE_DIR).resolve())).replace("\\", "/"),
        })
    return entries


def tree(rel: str = "", prefix: str = "") -> str:
    """Return an ASCII directory tree (used for AI context)."""
    root = _safe(rel)
    if not root.is_dir():
        return ""
    lines: list[str] = []
    items = sorted(root.iterdir())
    for i, item in enumerate(items):
        connector = "└── " if i == len(items) - 1 else "├── "
        lines.append(f"{prefix}{connector}{item.name}")
        if item.is_dir():
            ext = "    " if i == len(items) - 1 else "│   "
            lines.append(tree(
                str(item.relative_to(Path(WORKSPACE_DIR).resolve())),
                prefix + ext,
            ))
    return "\n".join(filter(None, lines))


# ── CRUD ──────────────────────────────────────────────────────

def read_file(rel: str) -> str:
    return _safe(rel).read_text(encoding="utf-8")


def write_file(rel: str, content: str) -> None:
    path = _safe(rel)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_file(rel: str, content: str = "") -> None:
    write_file(rel, content)


def delete_file(rel: str) -> None:
    path = _safe(rel)
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def create_folder(rel: str) -> None:
    _safe(rel).mkdir(parents=True, exist_ok=True)


def rename_path(old_rel: str, new_rel: str) -> None:
    _safe(old_rel).rename(_safe(new_rel))


# ── Zip import / export ──────────────────────────────────────

def extract_zip(data: bytes) -> None:
    """Extract uploaded zip into the workspace root."""
    with zipfile.ZipFile(BytesIO(data)) as zf:
        zf.extractall(Path(WORKSPACE_DIR))


def zip_project() -> bytes:
    """Return workspace as an in-memory zip archive."""
    buf = BytesIO()
    base = Path(WORKSPACE_DIR)
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(base):
            for f in files:
                full = Path(root) / f
                arcname = full.relative_to(base)
                zf.write(full, arcname)
    buf.seek(0)
    return buf.read()
