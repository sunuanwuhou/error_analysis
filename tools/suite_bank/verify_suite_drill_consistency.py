"""全库套卷：校验 `major_module` 与 `meta.section_heading`（答题卡分段横幅）一致。

在任意试卷、任意年份上均应成立；不局限于广东或某几年。

  docker compose exec -T app python3 /app/tools/suite_bank/verify_suite_drill_consistency.py

exit code 1 表示仍存在「横幅映射模块 ≠ major_module」的记录（应先跑 migrate_suite_drill_columns）。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo))

from backend.database import get_conn  # noqa: E402
from backend.services.suite_bank_drill import (  # noqa: E402
    MAJOR_QUANT,
    MAJOR_VERBAL,
    major_module_from_import_section,
)


def main() -> None:
    bad_mapped: list[tuple[str, str, str, str]] = []
    quant_verbal_banner = 0
    verbal_segment_intruders = 0

    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT q.id, q.major_module, q.meta_json
            FROM suite_questions q
            """
        ).fetchall()

    total = len(rows)
    for r in rows:
        d = dict(r)
        qid = str(d["id"])
        mm = str(d.get("major_module") or "").strip()
        meta: dict = {}
        raw_m = d.get("meta_json")
        if raw_m:
            try:
                meta = json.loads(str(raw_m))
            except json.JSONDecodeError:
                meta = {}
        raw_h = meta.get("section_heading")
        sec = raw_h.strip() if isinstance(raw_h, str) else ""
        mapped = major_module_from_import_section(sec)

        if mm == MAJOR_QUANT and "言语理解与表达" in sec:
            quant_verbal_banner += 1

        if sec == "言语理解与表达" and mm and mm != MAJOR_VERBAL:
            verbal_segment_intruders += 1

        if mm and mapped and mapped != mm:
            bad_mapped.append((qid, mm, mapped, sec[:80]))

    print(f"suite_questions scanned (all papers): {total}")
    print(f"banner maps import-section module != major_module: {len(bad_mapped)}")
    print(f"major_module=quant but banner still contains 言语理解与表达: {quant_verbal_banner}")
    print(f"banner exactly 言语理解与表达 but major_module != verbal: {verbal_segment_intruders}")

    if bad_mapped:
        for t in bad_mapped[:30]:
            print("  ", t)
        if len(bad_mapped) > 30:
            print(f"  ... +{len(bad_mapped) - 30} more")
        raise SystemExit(1)
    if quant_verbal_banner or verbal_segment_intruders:
        raise SystemExit(1)
    print("verify_suite_drill_consistency: OK")


if __name__ == "__main__":
    main()
