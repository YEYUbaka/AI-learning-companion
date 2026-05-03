import pytest
from fastapi import HTTPException
from starlette.datastructures import UploadFile

from routers.files import upload_file
from utils.file_parser import parse_file


def test_parse_file_rejects_legacy_doc_with_docx_guidance(tmp_path):
    file_path = tmp_path / "legacy.doc"
    file_path.write_bytes(b"legacy word bytes")

    with pytest.raises(ValueError) as exc_info:
        parse_file(str(file_path))

    assert "另存为 .docx" in str(exc_info.value)


@pytest.mark.asyncio
async def test_upload_file_rejects_legacy_doc_with_docx_guidance():
    import io

    upload = UploadFile(file=io.BytesIO(b"legacy word bytes"), filename="legacy.doc")

    with pytest.raises(HTTPException) as exc_info:
        await upload_file(upload)

    assert getattr(exc_info.value, "status_code", None) == 400
    assert "另存为 .docx" in str(getattr(exc_info.value, "detail", ""))
