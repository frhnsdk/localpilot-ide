"""
File-system API – CRUD + zip import/export.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from services import file_service

router = APIRouter(prefix="/api/files", tags=["files"])


# ── Schemas ───────────────────────────────────────────────────

class FileBody(BaseModel):
    path: str
    content: str = ""

class RenamBody(BaseModel):
    old_path: str
    new_path: str

class PathBody(BaseModel):
    path: str


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/list")
def list_dir(path: str = ""):
    """Return direct children of a directory."""
    return file_service.list_directory(path)


@router.get("/read")
def read(path: str):
    try:
        return {"content": file_service.read_file(path)}
    except FileNotFoundError:
        raise HTTPException(404, "File not found")


@router.post("/write")
def write(body: FileBody):
    file_service.write_file(body.path, body.content)
    return {"ok": True}


@router.post("/create")
def create(body: FileBody):
    file_service.create_file(body.path, body.content)
    return {"ok": True}


@router.post("/create_folder")
def create_folder(body: PathBody):
    file_service.create_folder(body.path)
    return {"ok": True}


@router.post("/delete")
def delete(body: PathBody):
    file_service.delete_file(body.path)
    return {"ok": True}


@router.post("/rename")
def rename(body: RenamBody):
    file_service.rename_path(body.old_path, body.new_path)
    return {"ok": True}


@router.post("/upload_zip")
async def upload_zip(file: UploadFile = File(...)):
    data = await file.read()
    file_service.extract_zip(data)
    return {"ok": True}


@router.get("/download_zip")
def download_zip():
    data = file_service.zip_project()
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=project.zip"},
    )
