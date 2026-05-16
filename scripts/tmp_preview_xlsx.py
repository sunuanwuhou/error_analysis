"""Preview workbook structure without openpyxl (stdlib only)."""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def ln(tag: str) -> str:
    return tag.split('}', 1)[-1]


def ss_list(z: zipfile.ZipFile) -> list[str]:
    cand = None
    for n in z.namelist():
        if n.lower() == "xl/sharedstrings.xml":
            cand = n
            break
    out: list[str] = []
    if not cand:
        return out
    root = ET.fromstring(z.read(cand))
    for si in root.iter():
        if ln(si.tag) != "si":
            continue
        chunks: list[str] = []
        for ch in si.iter():
            if ln(ch.tag) == "t" and ch.text:
                chunks.append(ch.text)
        out.append("".join(chunks))
    return out


def cell_text(c: ET.Element, sst: list[str]) -> str:
    t_attr = c.get("t")
    v_el = None
    is_el = None
    for ch in c:
        ctl = ln(ch.tag)
        if ctl == "v":
            v_el = ch
        if ctl == "is":
            is_el = ch
    if is_el is not None:
        parts: list[str] = []
        for t in is_el.iter():
            if ln(t.tag) == "t" and t.text:
                parts.append(t.text)
        return "".join(parts)
    if v_el is None or v_el.text is None:
        return ""
    raw = v_el.text
    if t_attr == "s":
        idx = int(float(raw))
        return sst[idx] if idx < len(sst) else f"<sst:{idx}>"
    return raw


def sheet_rows(z: zipfile.ZipFile, sheet_path: str, sst: list[str], *, max_rows: int) -> list[list[str]]:
    root = ET.fromstring(z.read(sheet_path))
    rows_out: list[list[str]] = []
    for row in root.iter():
        if ln(row.tag) != "row":
            continue
        cols: dict[int, str] = {}
        r_idx = row.get("r")
        for c in row:
            if ln(c.tag) != "c":
                continue
            ref = c.get("r") or ""
            col_part = "".join(x for x in ref if x.isalpha())
            if not col_part:
                continue
            n = 0
            for ch in col_part:
                n = n * 26 + ord(ch.upper()) - 64
            col_ix = n - 1
            cols[col_ix] = cell_text(c, sst)
        if cols:
            max_c = max(cols)
            filled = [cols.get(i, "") for i in range(max_c + 1)]
            rows_out.append([r_idx or "", *filled])
        if len(rows_out) >= max_rows:
            break
    return rows_out


def sheet_paths(z: zipfile.ZipFile) -> tuple[list[str], list[str]]:
    root = ET.fromstring(z.read("xl/workbook.xml"))
    rel_root = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    sid_to_tgt: dict[str, str] = {}
    for rel in rel_root.iter():
        if ln(rel.tag) != "Relationship":
            continue
        rid = rel.get("Id")
        tgt = rel.get("Target") or ""
        if rid:
            sid_to_tgt[rid] = tgt.replace("\\", "/")

    names: list[tuple[str, str]] = []
    for sh in root.iter():
        if ln(sh.tag) != "sheet":
            continue
        sid = sh.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        title = sh.get("name") or "?"
        if sid:
            names.append((sid, title))

    titles_ordered: list[str] = []
    paths: list[str] = []
    for sid, title in names:
        tgt = sid_to_tgt.get(sid, "")
        tgt = tgt.replace("\\", "/")
        if tgt.startswith("../"):
            p = "xl/" + tgt.removeprefix("../")
        elif tgt.startswith("/"):
            p = tgt.lstrip("/")
        else:
            p = "xl/" + tgt
        titles_ordered.append(title)
        paths.append(p)
    return titles_ordered, paths


def preview(path: Path, peek_rows: int = 35, max_sheets_preview: int = 45) -> None:
    path = Path(path)
    if not path.exists():
        print("MISSING:", path)
        return
    with zipfile.ZipFile(path) as z:
        sheets, targets = sheet_paths(z)
        sst = ss_list(z)
        print(f"FILE: {path.name}  ({path.stat().st_size / 1024 / 1024:.2f} MB)")
        print(f"SHEETS: {len(sheets)}")
        print(f"sharedStrings.count: {len(sst)}\n")

        shown = min(len(sheets), max_sheets_preview)
        for i in range(shown):
            title = sheets[i]
            sp = targets[i]
            print(f"\n===== SHEET [{i + 1}] {title!r}\n      path: {sp}")
            try:
                rows = sheet_rows(z, sp, sst, max_rows=peek_rows)
            except KeyError as e:
                print("  ERRO OPEN:", e)
                continue
            non_empty_lines = []
            max_cols_seen = max((max(0, len(r) - 1) for r in rows), default=0)
            print(f"  first {len(rows)} raw rows scanned, max_cols ~{max_cols_seen}")
            header_note = ""
            if rows:
                r0 = rows[0][1:] if len(rows[0]) > 1 else []
                top = "|".join(
                    (_short(x, 72) + f"@{j}" for j, x in enumerate(r0[:20]) if str(x).strip())
                )
                if top:
                    header_note = "ROW1 cells: " + top
                    print(f"  {header_note}")

            max_show_cols = min(max_cols_seen, 18)
            for ridx, r in enumerate(rows, start=1):
                vals = [(str(v) if v is not None else "") for v in r[1 : 1 + max_show_cols]]
                if any(x.strip() for x in vals):
                    line = " | ".join(_short(v, 140) for v in vals).replace("|", "\u00a6")
                    non_empty_lines.append((ridx, line))
            print(f"  non_empty_preview_lines: {len(non_empty_lines)} (show ≤24)")
            for ridx, line in non_empty_lines[:24]:
                print(f"   L{ridx:02d} {line}")
        if len(sheets) > shown:
            print(f"\n… {len(sheets) - shown} additional sheets omitted from preview")


def _short(v: str, n: int) -> str:
    s = str(v).replace("\n", " ").replace("\r", " ").strip()
    if len(s) > n:
        return s[: n - 1] + "…"
    return s


if __name__ == "__main__":
    default = Path(__file__).resolve().parent.parent / "申论套卷.xlsx"
    p = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else default
    preview(p)
