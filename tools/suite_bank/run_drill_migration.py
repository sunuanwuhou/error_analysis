"""One-shot: recompute suite_papers drill columns + suite_questions.major_module（全库）。

跑完后自动执行全库一致性校验；仅校验失败时进程 exit 1。

镜像内需先有本文件（通过镜像构建 COPY），否则可用 stdin：

  docker compose exec -T app python3 - <<'PY'
  from backend.services.suite_bank_drill import migrate_suite_drill_columns
  migrate_suite_drill_columns()
  PY

或直接：

  docker compose exec -T app python3 /app/tools/suite_bank/run_drill_migration.py
"""

from __future__ import annotations

import sys
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
_tools_suite_bank = Path(__file__).resolve().parent
sys.path.insert(0, str(repo))
sys.path.insert(0, str(_tools_suite_bank))

from backend.services.suite_bank_drill import migrate_suite_drill_columns  # noqa: E402


def main() -> None:
    migrate_suite_drill_columns()
    print("migrate_suite_drill_columns: OK")
    from verify_suite_drill_consistency import main as verify_main  # noqa: E402

    verify_main()


if __name__ == "__main__":
    main()
