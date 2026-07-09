"""Extract plain text from uploaded source files.

Rhinalx stores exact text spans, so extraction is intentionally conservative: it
returns text that is actually present in the file and refuses files that need OCR
or a proprietary parser. Supported production paths cover selectable PDFs,
modern Office documents, spreadsheets, slide decks, CSV/TSV, JSON, XML/HTML, RTF,
and normal text exports.
"""
from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

TEXT_EXTS = {
    ".txt", ".text", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl",
    ".log", ".rtf", ".xml", ".html", ".htm", ".yaml", ".yml", ".ini", ".toml",
    ".py", ".js", ".ts", ".tsx", ".jsx", ".css", ".sql", "",
}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff", ".bmp", ".heic"}
OFFICE_EXTS = {".docx", ".xlsx", ".xlsm", ".pptx"}
WORD_PARTS = (
    "word/document.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    "word/comments.xml",
)


def _normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _xml_text(xml_bytes: bytes, *, joiner: str = " ") -> str:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return ""
    chunks: list[str] = []
    for node in root.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        if tag in {"t", "instrText", "delText"} and node.text:
            chunks.append(node.text)
        elif tag == "tab":
            chunks.append("\t")
        elif tag in {"br", "p", "tr"}:
            chunks.append("\n")
    return _normalize(joiner.join(chunks))


def _zip_read(zf: zipfile.ZipFile, name: str) -> bytes | None:
    try:
        return zf.read(name)
    except KeyError:
        return None


def _decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "utf-16", "latin-1"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = data.decode("utf-8", errors="replace")

    sample = text[:4096]
    if sample:
        controls = sum(1 for ch in sample if ord(ch) < 32 and ch not in "\n\r\t")
        replacement = sample.count("\ufffd")
        if controls > max(12, len(sample) * 0.03) or replacement > max(8, len(sample) * 0.02):
            raise ValueError("this file appears to be binary and has no readable text layer")
    return _normalize(text)


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    parts: list[str] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            parts.append(f"[page {i}]\n{text.strip()}")
    return _normalize("\n\n".join(parts))


def _docx(data: bytes) -> str:
    parts: list[str] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in WORD_PARTS:
            xml = _zip_read(zf, name)
            if xml:
                text = _xml_text(xml)
                if text:
                    parts.append(text)
        for name in sorted(n for n in zf.namelist() if n.startswith("word/header") or n.startswith("word/footer")):
            text = _xml_text(zf.read(name))
            if text:
                parts.append(text)
    return _normalize("\n\n".join(parts))


def _shared_strings(zf: zipfile.ZipFile) -> list[str]:
    xml = _zip_read(zf, "xl/sharedStrings.xml")
    if not xml:
        return []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    out: list[str] = []
    for si in root:
        texts = [node.text or "" for node in si.iter() if node.tag.rsplit("}", 1)[-1] == "t"]
        out.append("".join(texts))
    return out


def _sheet_name_map(zf: zipfile.ZipFile) -> dict[str, str]:
    workbook = _zip_read(zf, "xl/workbook.xml")
    rels = _zip_read(zf, "xl/_rels/workbook.xml.rels")
    if not workbook or not rels:
        return {}
    try:
        wb_root = ET.fromstring(workbook)
        rel_root = ET.fromstring(rels)
    except ET.ParseError:
        return {}
    rel_targets = {
        rel.attrib.get("Id"): "xl/" + rel.attrib.get("Target", "").lstrip("/")
        for rel in rel_root
    }
    names: dict[str, str] = {}
    for sheet in wb_root.iter():
        if sheet.tag.rsplit("}", 1)[-1] != "sheet":
            continue
        rid = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        target = rel_targets.get(rid)
        if target:
            names[target] = sheet.attrib.get("name", Path(target).stem)
    return names


def _xlsx(data: bytes) -> str:
    parts: list[str] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        shared = _shared_strings(zf)
        names = _sheet_name_map(zf)
        sheet_files = sorted(n for n in zf.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n))
        for sheet_file in sheet_files:
            label = names.get(sheet_file, Path(sheet_file).stem)
            rows: list[str] = []
            try:
                root = ET.fromstring(zf.read(sheet_file))
            except ET.ParseError:
                continue
            for row in root.iter():
                if row.tag.rsplit("}", 1)[-1] != "row":
                    continue
                cells: list[str] = []
                for cell in row:
                    if cell.tag.rsplit("}", 1)[-1] != "c":
                        continue
                    cell_type = cell.attrib.get("t")
                    value = ""
                    inline_text: list[str] = []
                    for node in cell.iter():
                        tag = node.tag.rsplit("}", 1)[-1]
                        if tag == "t" and node.text:
                            inline_text.append(node.text)
                        elif tag == "v" and node.text:
                            value = node.text
                    if cell_type == "s" and value.isdigit() and int(value) < len(shared):
                        cells.append(shared[int(value)])
                    elif inline_text:
                        cells.append("".join(inline_text))
                    elif value:
                        cells.append(value)
                if any(c.strip() for c in cells):
                    rows.append(" | ".join(cells))
            if rows:
                parts.append(f"[{label}]\n" + "\n".join(rows))
    return _normalize("\n\n".join(parts))


def _pptx(data: bytes) -> str:
    parts: list[str] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        slide_files = sorted(
            (n for n in zf.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
            key=lambda n: int(re.search(r"slide(\d+)\.xml", n).group(1)),
        )
        for i, name in enumerate(slide_files, start=1):
            text = _xml_text(zf.read(name))
            if text:
                parts.append(f"[slide {i}]\n{text}")
    return _normalize("\n\n".join(parts))


def _rtf(data: bytes) -> str:
    text = _decode(data)
    text = re.sub(r"\\'[0-9a-fA-F]{2}", " ", text)
    text = re.sub(r"\\[a-zA-Z]+-?\d* ?", " ", text)
    text = text.replace("{", " ").replace("}", " ").replace("\\", " ")
    return _normalize(re.sub(r"\s+", " ", text))


def _html(data: bytes) -> str:
    text = _decode(data)
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return _normalize(re.sub(r"[ \t]{2,}", " ", text))


def _office_zip_text(data: bytes) -> str:
    parts: list[str] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in sorted(n for n in zf.namelist() if n.endswith(".xml")):
            text = _xml_text(zf.read(name))
            if text:
                parts.append(f"[{name}]\n{text}")
    return _normalize("\n\n".join(parts))


def extract_text(filename: str, data: bytes) -> str:
    """Return plain text from an uploaded file. Empty string means no text found."""
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTS:
        raise ValueError("image uploads need OCR before Rhinalx can preserve source spans")
    if ext == ".pdf":
        return _pdf(data)
    if ext == ".docx":
        return _docx(data)
    if ext in {".xlsx", ".xlsm"}:
        return _xlsx(data)
    if ext == ".pptx":
        return _pptx(data)
    if ext == ".doc":
        raise ValueError("legacy .doc is not supported - please export to .docx or PDF")
    if ext == ".xls":
        raise ValueError("legacy .xls is not supported - please export to .xlsx or CSV")
    if ext == ".ppt":
        raise ValueError("legacy .ppt is not supported - please export to .pptx or PDF")
    if ext == ".rtf":
        return _rtf(data)
    if ext in {".html", ".htm"}:
        return _html(data)
    if ext in OFFICE_EXTS or zipfile.is_zipfile(io.BytesIO(data)):
        return _office_zip_text(data)
    if ext and ext not in TEXT_EXTS:
        try:
            return _decode(data)
        except ValueError as exc:
            raise ValueError(
                f"unsupported file type '{ext}' - export to PDF, DOCX, XLSX, PPTX, CSV, TXT, or paste the text"
            ) from exc
    return _decode(data)