"""
File upload routes.
"""
from __future__ import annotations

import mimetypes
import os
import shutil
import time
from typing import Dict

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from utils.file_parser import get_file_info, parse_file


router = APIRouter(prefix="/api/v1/files", tags=["files"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DOC_FORMAT_ERROR = "暂不支持 .doc 格式上传，请将文件另存为 .docx 后重新上传。"
DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown", ".docx", ".pptx"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ALLOWED_EXTENSIONS = DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS
MAX_FILE_SIZE = 10 * 1024 * 1024


def _resolve_file_type(file_ext: str) -> str:
    if file_ext in IMAGE_EXTENSIONS:
        return "image"
    if file_ext in DOCUMENT_EXTENSIONS:
        return "document"
    return "file"


def _safe_filename(file_name: str) -> str:
    name, ext = os.path.splitext(file_name or "upload")
    safe_stem = "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in name)[:80] or "upload"
    return f"{safe_stem}_{int(time.time() * 1000)}{ext.lower()}"


def _build_attachment_payload(
    *,
    original_name: str,
    relative_path: str,
    mime_type: str,
    file_type: str,
    preview_url: str,
    file_size: int,
) -> Dict[str, str]:
    return {
        "name": original_name,
        "file_name": original_name,
        "file_path": relative_path,
        "file_url": preview_url,
        "mime_type": mime_type,
        "file_type": file_type,
        "type": "image" if file_type == "image" else "file_reference",
        "image_url": preview_url if file_type == "image" else None,
        "size": file_size,
    }


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext == ".doc":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=DOC_FORMAT_ERROR,
        )
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unsupported file type: {file_ext}",
        )

    file_type = _resolve_file_type(file_ext)
    saved_name = _safe_filename(file.filename or "upload")
    relative_path = os.path.join(UPLOAD_DIR, saved_name)
    absolute_path = os.path.abspath(relative_path)

    try:
        with open(absolute_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_size = os.path.getsize(absolute_path)
        if file_size > MAX_FILE_SIZE:
            os.remove(absolute_path)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file is too large")

        mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
        preview_url = f"/uploads/{saved_name}"

        text_content = ""
        text_length = 0
        if file_type == "document":
            try:
                text_content, text_length = parse_file(absolute_path)
            except ValueError as exc:
                if os.path.exists(absolute_path):
                    os.remove(absolute_path)
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"failed to parse file: {exc}") from exc
            except Exception as exc:  # pylint: disable=broad-except
                if os.path.exists(absolute_path):
                    os.remove(absolute_path)
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"failed to parse file: {exc}") from exc

        attachment = _build_attachment_payload(
            original_name=file.filename or saved_name,
            relative_path=relative_path.replace("\\", "/"),
            mime_type=mime_type,
            file_type=file_type,
            preview_url=preview_url,
            file_size=file_size,
        )
        return JSONResponse(
            {
                "success": True,
                "file_name": file.filename,
                "file_path": relative_path.replace("\\", "/"),
                "file_size": file_size,
                "file_type": file_type,
                "mime_type": mime_type,
                "preview_url": preview_url,
                "text_length": text_length,
                "text_content": text_content,
                "text_preview": text_content[:200] + "..." if text_content and len(text_content) > 200 else text_content,
                "attachment": attachment,
                "message": "file uploaded successfully",
            }
        )
    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"file upload failed: {exc}") from exc


@router.get("/info/{file_name}")
async def get_file_info_endpoint(file_name: str):
    file_path = os.path.join(UPLOAD_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="file not found")
    try:
        return JSONResponse({"success": True, "file_info": get_file_info(file_path)})
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"failed to get file info: {exc}") from exc
