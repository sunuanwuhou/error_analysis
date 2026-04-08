from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_PAGE = ROOT / "ui" / "src" / "views" / "WorkspacePage.vue"


def assert_contains(text: str, snippet: str, label: str) -> None:
    if snippet not in text:
        raise AssertionError(f"Missing {label}: {snippet}")


def main() -> None:
    if not WORKSPACE_PAGE.exists():
        raise SystemExit("WorkspacePage.vue does not exist")

    source = WORKSPACE_PAGE.read_text(encoding="utf-8")

    required_routes = {
        "/": "legacy workbench route",
        "/shenlun": "shenlun route",
        "/next/tools/search": "global search bridge",
        "/next/tools/note-editor": "note editor bridge",
        "/next/tools/note-viewer": "note viewer bridge",
        "/next/tools/process-image": "process image bridge",
        "/next/tools/quick-import": "quick import bridge",
        "/next/tools/canvas": "canvas bridge",
        "/next/tools/claude-bank/refresh": "claude bank refresh bridge",
        "/next/tools/backup/restore": "backup restore bridge",
        "/next/tools/backup/delete": "backup delete bridge",
        "/next/tools/remarks/daily-log": "remark daily log bridge",
        "/next/actions/recommended-notes": "recommended notes bridge",
        "/next/actions/recommended-note": "single recommended note bridge",
        "/next/workspace/tasks/errors": "workspace task errors bridge",
        "/next/workspace/tasks/notes": "workspace task notes bridge",
        "/next/tools/edit": "edit error bridge",
    }
    for route, label in required_routes.items():
        assert_contains(source, route, label)

    forbidden_snippets = {
        "TODO": "leftover placeholder",
        "generic admin": "generic admin shell wording",
    }
    for snippet, label in forbidden_snippets.items():
        if snippet in source:
            raise AssertionError(f"Forbidden {label}: {snippet}")

    print("Next preview guardrail check passed.")
    print("- Verified real route bridges in WorkspacePage.vue")


if __name__ == "__main__":
    main()
