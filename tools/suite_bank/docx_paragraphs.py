"""Extract text + embedded pictures from .docx in document order (stdlib only).

规则与版式约定见：docs/active/SUITE_BANK_WORD_IMPORT_RULES.md

粉笔导出的图形题常为段落内嵌入图片（非原生表格）。``w:tbl`` 单元格内若为段落插图，
同样输出带 ``<img class="sb-inline-img">`` 的 HTML（与段落抽取共用 walker）。
"""

from __future__ import annotations

import base64
import html as html_lib
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
_W_URI = _NS["w"]
_HTML_TAG_RE = re.compile(r"<[^>]*>")


def _strip_tags(s: str) -> str:
    return _HTML_TAG_RE.sub("", s)


def _tag_ln(tag: str) -> str:
    if tag.startswith("{"):
        return tag.rsplit("}", 1)[-1]
    return tag


def _gather_text(elem: ET.Element) -> str:
    parts: list[str] = []
    for node in elem.findall(".//w:t", _NS):
        if node.text:
            parts.append(node.text)
        if node.tail:
            parts.append(node.tail)
    return "".join(parts).replace("\u00a0", " ").strip()


def _grid_span(tc: ET.Element) -> int:
    tc_pr = tc.find("w:tcPr", _NS)
    if tc_pr is None:
        return 1
    gs = tc_pr.find("w:gridSpan", _NS)
    if gs is None:
        return 1
    val = gs.get(f"{{{_W_URI}}}val") or gs.get("val")
    try:
        return max(1, int(val))
    except (TypeError, ValueError):
        return 1


def _tc_cell_html(tc: ET.Element, zf: zipfile.ZipFile, rels: dict[str, str]) -> str:
    """Serialize one table cell: paragraphs (mixed HTML) + nested tables."""
    chunks: list[str] = []
    for node in list(tc):
        ln = _tag_ln(node.tag)
        if ln == "tcPr":
            continue
        if ln == "p":
            mixed = _paragraph_to_mixed_html(node, zf, rels)
            if mixed:
                chunks.append(mixed)
                continue
            plain = _gather_text(node).strip()
            img_b = _first_embedded_image(zf, rels, node)
            if plain:
                chunks.append(html_lib.escape(plain.replace("\u00a0", " ")))
            elif img_b:
                chunks.append(_inline_img_html(img_b))
            continue
        if ln == "tbl":
            nested = _table_lines(node, zf, rels)
            if nested:
                chunks.append("<br/>".join(nested))
            continue

    if chunks:
        return "<br/>".join(chunks)
    plain = _gather_text(tc).strip()
    return html_lib.escape(plain.replace("\u00a0", " ")) if plain else ""


def _table_lines(tbl: ET.Element, zf: zipfile.ZipFile, rels: dict[str, str]) -> list[str]:
    rows_out: list[str] = []
    for tr in tbl.findall("./w:tr", _NS):
        cells: list[str] = []
        for tc in tr.findall("w:tc", _NS):
            span = _grid_span(tc)
            disp = _tc_cell_html(tc, zf, rels)
            cells.append(disp if disp else "")
            cells.extend([""] * (span - 1))
        if not cells:
            continue
        if not any(_strip_tags(c).strip() for c in cells):
            continue
        rows_out.append(" | ".join(cells))
    return rows_out


def _load_document_rels(zf: zipfile.ZipFile) -> dict[str, str]:
    raw = zf.read("word/_rels/document.xml.rels")
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    root = ET.fromstring(raw)
    mp: dict[str, str] = {}
    for rel in root:
        if _tag_ln(rel.tag) != "Relationship":
            continue
        rid = rel.get("Id") or ""
        tgt = rel.get("Target") or ""
        if rid and tgt:
            mp[rid] = tgt.replace("\\", "/").strip()
    return mp


def _zip_path_for_rel_target(target: str) -> str:
    """Map OOXML Relationship Target to zip member path (often package-root ``media/…``)."""
    t = target.strip().replace("\\", "/")
    while t.startswith("../"):
        t = t[3:]
    t = t.lstrip("/")
    if not t:
        return t
    top = t.split("/", 1)[0]
    if top.lower() in ("media", "customxml", "docprops"):
        return t
    if t.startswith("word/"):
        return t
    return "word/" + t.lstrip("/")


def _bytes_to_data_uri(image_bytes: bytes) -> str:
    b = image_bytes
    if len(b) >= 8 and b[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    elif len(b) >= 2 and b[:2] == b"\xff\xd8":
        mime = "image/jpeg"
    elif len(b) >= 6 and b[:6] in (b"GIF87a", b"GIF89a"):
        mime = "image/gif"
    else:
        mime = "image/png"
    enc = base64.standard_b64encode(b).decode("ascii")
    return f"data:{mime};base64,{enc}"


def _inline_img_html(data: bytes) -> str:
    uri = _bytes_to_data_uri(data)
    return f'<img class="sb-inline-img" src="{uri}" alt="" />'


def _escape_visible_text(chunk: str) -> str:
    return html_lib.escape(chunk.replace("\u00a0", " "))


def _ordered_chunks_from_run(r: ET.Element, zf: zipfile.ZipFile, rels: dict[str, str]) -> list[str]:
    chunks: list[str] = []
    for node in list(r):
        ln = _tag_ln(node.tag)
        if ln == "rPr":
            continue
        if ln == "t":
            if node.text:
                chunks.append(_escape_visible_text(node.text))
            continue
        if ln == "drawing":
            ib = _first_embedded_image(zf, rels, node)
            if ib:
                chunks.append(_inline_img_html(ib))
            continue
        if ln == "tab":
            chunks.append(" ")
            continue
        if ln == "br":
            chunks.append(" ")
            continue
        if ln == "AlternateContent":
            chunks.extend(_chunks_from_walk(node, zf, rels))
            continue
        chunks.extend(_chunks_from_walk(node, zf, rels))
    return chunks


def _chunks_from_walk(node: ET.Element, zf: zipfile.ZipFile, rels: dict[str, str]) -> list[str]:
    tag = _tag_ln(node.tag)
    if tag == "r":
        return _ordered_chunks_from_run(node, zf, rels)
    if tag == "hyperlink":
        acc: list[str] = []
        for sub in node:
            acc.extend(_chunks_from_walk(sub, zf, rels))
        return acc
    if tag == "AlternateContent":
        choices = [c for c in node if _tag_ln(c.tag) == "Choice"]
        if choices:
            acc = []
            for sub in choices[0]:
                if _tag_ln(sub.tag) == "Fallback":
                    continue
                acc.extend(_chunks_from_walk(sub, zf, rels))
            return acc
        fallbacks = [c for c in node if _tag_ln(c.tag) == "Fallback"]
        inner = fallbacks[0] if fallbacks else node
        acc = []
        for sub in inner:
            acc.extend(_chunks_from_walk(sub, zf, rels))
        return acc
    if tag == "sdt":
        content = node.find("w:sdtContent", _NS)
        if content is None:
            return []
        acc = []
        for sub in content:
            acc.extend(_chunks_from_walk(sub, zf, rels))
        return acc
    if tag == "drawing":
        ib = _first_embedded_image(zf, rels, node)
        return [_inline_img_html(ib)] if ib else []
    if tag in ("bookmarkStart", "bookmarkEnd", "proofErr", "customXml"):
        return []
    acc = []
    for sub in node:
        acc.extend(_chunks_from_walk(sub, zf, rels))
    return acc


def _paragraph_to_mixed_html(p: ET.Element, zf: zipfile.ZipFile, rels: dict[str, str]) -> str:
    parts: list[str] = []
    for node in list(p):
        parts.extend(_chunks_from_walk(node, zf, rels))
    return "".join(parts).strip()


def _embedded_image_rel_ids(root: ET.Element) -> list[str]:
    """Relationship ids from DrawingML ``blip`` embed + legacy VML ``imagedata`` r:id."""
    ordered: list[str] = []
    seen: set[str] = set()
    for el in root.iter():
        ln = _tag_ln(el.tag)
        if ln == "blip":
            for k, v in el.attrib.items():
                if k.endswith("}embed") or k == "embed":
                    if v and v not in seen:
                        seen.add(v)
                        ordered.append(v)
                    break
            continue
        if ln == "imagedata":
            for k, v in el.attrib.items():
                if k.endswith("}id") or k == "id":
                    if v and v not in seen:
                        seen.add(v)
                        ordered.append(v)
                    break
    return ordered


def _first_embedded_image(zf: zipfile.ZipFile, rels: dict[str, str], p: ET.Element) -> bytes | None:
    for eid in _embedded_image_rel_ids(p):
        tgt = rels.get(eid)
        if not tgt:
            continue
        zp = _zip_path_for_rel_target(tgt)
        try:
            return zf.read(zp)
        except KeyError:
            continue
    return None


def read_docx_for_suite_import(docx_path: Path) -> tuple[list[str], dict[int, bytes]]:
    """
    Returns:
      lines — flattened paragraphs / table rows (same shape Fenbi parser expects).
        Paragraph lines may embed ``<img class="sb-inline-img" src="data:…">`` after escaped text.
      stem_images — header LINE INDEX -> image bytes only when the paragraph has an embedded blip
        that was **not** inlined into the line string (配图段落常见).
    """
    docx_path = Path(docx_path)
    lines: list[str] = []
    stem_images: dict[int, bytes] = {}

    with zipfile.ZipFile(docx_path, "r") as zf:
        rels = _load_document_rels(zf)
        xml_bytes = zf.read("word/document.xml")
        root = ET.fromstring(xml_bytes)
        body = root.find("w:body", _NS)
        if body is None:
            return lines, stem_images

        for child in body:
            tag = _tag_ln(child.tag)
            if tag == "p":
                mixed = _paragraph_to_mixed_html(child, zf, rels)
                plain_txt = _gather_text(child).strip()
                img_b = _first_embedded_image(zf, rels, child)
                if mixed:
                    line_body = mixed
                elif plain_txt:
                    line_body = plain_txt
                elif img_b:
                    line_body = "（本题含图示，见下方插图）"
                else:
                    continue
                idx = len(lines)
                lines.append(line_body)
                if img_b and "<img" not in line_body:
                    stem_images[idx] = img_b
            elif tag == "tbl":
                for row_line in _table_lines(child, zf, rels):
                    lines.append(row_line)

    return lines, stem_images


def non_empty_paragraphs(docx_path: Path) -> list[str]:
    """Backward-compatible: text/table rows only (no pictures)."""
    lines, _ = read_docx_for_suite_import(docx_path)
    return [t for t in lines if t.strip()]
