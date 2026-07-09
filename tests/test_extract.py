from __future__ import annotations

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from backend import extract
from backend.main import app


def _zip(parts: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in parts.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_docx_extracts_document_and_header_text():
    data = _zip({
        "word/document.xml": """
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body><w:p><w:r><w:t>Dose changed to 250 ug/kg.</w:t></w:r></w:p></w:body>
            </w:document>
        """,
        "word/header1.xml": """
            <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:p><w:r><w:t>Cohort 3 notebook</w:t></w:r></w:p>
            </w:hdr>
        """,
    })

    text = extract.extract_text("note.docx", data)

    assert "Dose changed to 250 ug/kg" in text
    assert "Cohort 3 notebook" in text


def test_xlsx_extracts_shared_strings_and_values():
    data = _zip({
        "xl/workbook.xml": """
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets><sheet name="Decisions" sheetId="1" r:id="rId1" /></sheets>
            </workbook>
        """,
        "xl/_rels/workbook.xml.rels": """
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Target="worksheets/sheet1.xml" />
            </Relationships>
        """,
        "xl/sharedStrings.xml": """
            <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <si><t>Decision</t></si><si><t>Reduce LPS dose</t></si>
            </sst>
        """,
        "xl/worksheets/sheet1.xml": """
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <sheetData>
                <row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>
                <row><c><v>250</v></c><c t="inlineStr"><is><t>ug/kg</t></is></c></row>
              </sheetData>
            </worksheet>
        """,
    })

    text = extract.extract_text("decisions.xlsx", data)

    assert "[Decisions]" in text
    assert "Decision | Reduce LPS dose" in text
    assert "250 | ug/kg" in text


def test_pptx_extracts_slide_text():
    data = _zip({
        "ppt/slides/slide1.xml": """
            <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Rationale review</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
            </p:sld>
        """,
    })

    text = extract.extract_text("slides.pptx", data)

    assert "[slide 1]" in text
    assert "Rationale review" in text


def test_image_extract_refuses_with_ocr_message():
    with pytest.raises(ValueError, match="OCR"):
        extract.extract_text("scan.png", b"\x89PNG\r\n\x1a\n")


def test_upload_image_returns_422_with_clear_detail():
    client = TestClient(app)

    res = client.post("/ingest/file", files={"file": ("scan.png", b"\x89PNG\r\n\x1a\n", "image/png")})

    assert res.status_code == 422
    assert "OCR" in res.json()["detail"]