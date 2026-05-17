"""Import one Fenbi-style .docx into PostgreSQL suite_bank tables.

规则与版式约定见：docs/active/SUITE_BANK_WORD_IMPORT_RULES.md
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _img_data_uri(image_bytes: bytes) -> str:
    import base64

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


def main() -> None:
    repo = _repo_root()
    suite_bank_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(repo))
    sys.path.insert(0, str(suite_bank_dir))

    ap = argparse.ArgumentParser(description="Import Word 套卷 (粉笔风格块) → suite_bank")
    ap.add_argument("--docx", type=Path, required=True, help="Path to .docx inside container or host")
    ap.add_argument(
        "--source-rel-path",
        required=True,
        help="Stable key for replace_paper_bundle, e.g. word版本/广东省考/xxx.docx",
    )
    ap.add_argument("--folder", default="广东省考", help="suite_papers.folder")
    ap.add_argument(
        "--paper-id",
        default="",
        help="Optional fixed paper id; default derived from folder+title (dedupe_key), stable across re-import paths",
    )
    ap.add_argument("--dry-run", action="store_true", help="Parse only, print counts")
    args = ap.parse_args()

    from docx_paragraphs import read_docx_for_suite_import
    from parse_fb_docx_blocks import (
        extract_type_label,
        map_question_section_headings,
        parse_fenbi_paragraphs,
    )

    docx_path = Path(args.docx)
    paras, hdr_imgs = read_docx_for_suite_import(docx_path)
    title = paras[0] if paras and "《" in paras[0] else docx_path.stem
    parsed = parse_fenbi_paragraphs(paras, stem_images_by_header_line=hdr_imgs)
    section_map = map_question_section_headings(paras)

    nos = [p.question_no for p in parsed]
    if len(set(nos)) != len(nos):
        dup = [n for n in nos if nos.count(n) > 1]
        raise SystemExit(f"Duplicate question_no in Word: {sorted(set(dup))}")

    parsed_sorted = sorted(parsed, key=lambda x: x.question_no)
    order_ok = [p.question_no for p in parsed] == sorted(nos)
    if not order_ok:
        print("WARNING: Word block order differs from question_no sort; DB will use sorted order.", file=sys.stderr)

    from backend.services.suite_bank_service import (
        compute_suite_dedupe_key,
        replace_paper_bundle,
        stable_paper_id_for_dedupe,
    )

    dedupe_key = compute_suite_dedupe_key(args.folder, title)
    if args.paper_id.strip():
        paper_id = args.paper_id.strip()
    else:
        paper_id = stable_paper_id_for_dedupe(dedupe_key)

    bundle_questions: list[dict] = []
    for seq, pq in enumerate(parsed_sorted, start=1):
        qid = f"{paper_id}_q{seq:03d}"
        type_label = extract_type_label(pq.analysis_tail)
        sec = section_map.get(pq.question_no) or ""
        bundle_questions.append(
            {
                "id": qid,
                "seq_no": seq,
                "question_no": str(pq.question_no),
                "stem": pq.stem,
                "options": "\n".join(pq.options_lines),
                "answer": pq.answer,
                "analysis": pq.analysis_tail,
                "type_label": type_label,
                "img_data": _img_data_uri(pq.stem_image) if pq.stem_image else "",
                "meta": {
                    "label": pq.label,
                    "source": "word_import",
                    "orig_order": pq.seq_index,
                    "section_heading": sec,
                    "shared_material": pq.shared_material or "",
                },
            }
        )

    print(f"title: {title}")
    print(f"dedupe_key: {dedupe_key}")
    print(f"questions: {len(bundle_questions)} (question_no range {min(nos)}–{max(nos)})")
    if args.dry_run:
        for row in bundle_questions[:3]:
            print("--- sample ---")
            cp = dict(row)
            idata = cp.get("img_data")
            if isinstance(idata, str) and len(idata) > 140:
                cp["img_data"] = idata[:72] + "…(truncated)"
            meta = cp.get("meta")
            if isinstance(meta, dict) and isinstance(meta.get("shared_material"), str):
                sm = meta["shared_material"]
                if len(sm) > 160:
                    meta["shared_material"] = sm[:160] + "…(truncated)"
            print(json.dumps(cp, ensure_ascii=False, indent=2)[:1200])
        return

    replace_paper_bundle(
        paper_id=paper_id,
        dedupe_key=dedupe_key,
        source_rel_path=args.source_rel_path,
        title=title,
        folder=args.folder,
        questions=bundle_questions,
        meta={"import_script": "import_word_suite_bank.py", "question_count": len(bundle_questions)},
    )
    print(f"OK: paper_id={paper_id} dedupe_key={dedupe_key} source_rel_path={args.source_rel_path}")


if __name__ == "__main__":
    main()
