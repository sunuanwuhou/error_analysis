from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from backend.database import get_conn
from backend.schemas import LocalBackupCreatePayload
from backend.services.backup_service import create_local_backup_response
from backend.services.workspace_entity_service import invalidate_workspace_snapshot_cache


MOUNT_FIELDS = [
    "type",
    "subtype",
    "subSubtype",
    "noteNodeId",
    "knowledgePathTitles",
    "knowledgePath",
    "knowledgeNodePath",
    "notePath",
]


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_titles(value: Any) -> list[str]:
    if isinstance(value, list):
        return [_clean_text(v) for v in value if _clean_text(v)]
    return []


def _collect_error_like_records(node: Any, out: list[dict[str, Any]]) -> None:
    if isinstance(node, dict):
        if "question" in node and ("id" in node or "noteNodeId" in node):
            out.append(node)
        for value in node.values():
            _collect_error_like_records(value, out)
        return
    if isinstance(node, list):
        for item in node:
            _collect_error_like_records(item, out)


def _extract_backup_index(snapshot: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    _collect_error_like_records(snapshot, records)
    by_id: dict[str, dict[str, Any]] = {}
    by_question: dict[str, dict[str, Any]] = {}
    for row in records:
        question = _clean_text(row.get("question"))
        row_id = _clean_text(row.get("id"))
        if row_id and row_id not in by_id:
            by_id[row_id] = row
        if question and question not in by_question:
            by_question[question] = row
    return by_id, by_question


def _load_current_errors(user_id: str) -> list[tuple[str, dict[str, Any], str]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT entity_id, payload_json, updated_at
            FROM state_entities
            WHERE user_id = ? AND entity_type = 'error' AND deleted_at = ''
            ORDER BY updated_at ASC, entity_id ASC
            """,
            (user_id,),
        ).fetchall()
    result: list[tuple[str, dict[str, Any], str]] = []
    for row in rows:
        entity_id = _clean_text(row.get("entity_id"))
        updated_at = _clean_text(row.get("updated_at"))
        try:
            payload = json.loads(str(row.get("payload_json") or "{}"))
        except json.JSONDecodeError:
            payload = {}
        if isinstance(payload, dict):
            result.append((entity_id, payload, updated_at))
    return result


def _mount_view(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": _clean_text(payload.get("type")),
        "subtype": _clean_text(payload.get("subtype")),
        "subSubtype": _clean_text(payload.get("subSubtype")),
        "noteNodeId": _clean_text(payload.get("noteNodeId")),
        "knowledgePathTitles": _normalize_titles(payload.get("knowledgePathTitles")),
        "knowledgePath": _clean_text(payload.get("knowledgePath")),
        "knowledgeNodePath": _clean_text(payload.get("knowledgeNodePath")),
        "notePath": _clean_text(payload.get("notePath")),
    }


def _is_mount_diff(current_payload: dict[str, Any], backup_payload: dict[str, Any]) -> bool:
    return _mount_view(current_payload) != _mount_view(backup_payload)


def _apply_mount_fields(current_payload: dict[str, Any], backup_payload: dict[str, Any]) -> dict[str, Any]:
    next_payload = dict(current_payload)
    for key in MOUNT_FIELDS:
        if key == "knowledgePathTitles":
            next_payload[key] = _normalize_titles(backup_payload.get(key))
        else:
            next_payload[key] = backup_payload.get(key, "")
    return next_payload


def run(user_id: str, backup_path: Path, apply: bool, report_path: Path, make_safety_backup: bool) -> dict[str, Any]:
    snapshot = json.loads(backup_path.read_text(encoding="utf-8"))
    backup_by_id, backup_by_question = _extract_backup_index(snapshot)
    current_rows = _load_current_errors(user_id)
    now = datetime.now().astimezone().isoformat()

    changes: list[dict[str, Any]] = []
    matched = 0
    for entity_id, payload, updated_at in current_rows:
        question = _clean_text(payload.get("question"))
        backup_payload = None
        if entity_id and entity_id in backup_by_id:
            backup_payload = backup_by_id[entity_id]
        elif question and question in backup_by_question:
            backup_payload = backup_by_question[question]
        if not backup_payload:
            continue
        matched += 1
        if not _is_mount_diff(payload, backup_payload):
            continue
        next_payload = _apply_mount_fields(payload, backup_payload)
        changes.append(
            {
                "entity_id": entity_id,
                "question": question[:120],
                "updated_at": updated_at,
                "before": _mount_view(payload),
                "after": _mount_view(next_payload),
                "next_payload": next_payload,
            }
        )

    safety_backup: dict[str, Any] | None = None
    applied = 0
    if apply and changes:
        if make_safety_backup:
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safety_backup = create_local_backup_response(
                user_id,
                LocalBackupCreatePayload(
                    kind="before_restore",
                    label=f"题目挂载修复前备份 {stamp}",
                    skipRecentHours=0,
                ),
            )
        with get_conn() as conn:
            for item in changes:
                payload = item["next_payload"]
                row_updated_at = _clean_text(payload.get("updatedAt")) or now
                conn.execute(
                    """
                    INSERT INTO state_entities(user_id, entity_type, entity_id, payload_json, updated_at, deleted_at)
                    VALUES (?, 'error', ?, ?, ?, '')
                    ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
                      payload_json = excluded.payload_json,
                      updated_at = excluded.updated_at,
                      deleted_at = ''
                    """,
                    (user_id, item["entity_id"], json.dumps(payload, ensure_ascii=False), row_updated_at),
                )
                applied += 1
            conn.commit()
        invalidate_workspace_snapshot_cache(user_id)

    report = {
        "user_id": user_id,
        "backup_path": str(backup_path),
        "current_error_count": len(current_rows),
        "backup_match_count": matched,
        "mount_mismatch_count": len(changes),
        "applied_count": applied,
        "applied": bool(apply),
        "safety_backup": safety_backup.get("item") if isinstance(safety_backup, dict) else None,
        "changes": [
            {
                "entity_id": item["entity_id"],
                "question": item["question"],
                "before": item["before"],
                "after": item["after"],
            }
            for item in changes
        ],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="对比备份并恢复错题挂载字段")
    parser.add_argument("--user-id", required=True, help="用户ID")
    parser.add_argument("--backup-id", required=True, help="备份ID（data/backups/<user>/<backup-id>）")
    parser.add_argument("--apply", action="store_true", help="执行写入；默认仅扫描")
    parser.add_argument("--no-safety-backup", action="store_true", help="执行写入时不创建安全备份")
    parser.add_argument(
        "--report-file",
        default="data/backups/_mount_restore_reports/restore_mount_report.json",
        help="报告输出路径（相对仓库根目录）",
    )
    args = parser.parse_args()

    backup_path = Path("data") / "backups" / args.user_id / args.backup_id / "snapshot.json"
    if not backup_path.exists():
        raise SystemExit(f"Backup snapshot not found: {backup_path}")
    report_path = Path(args.report_file)

    result = run(
        user_id=args.user_id,
        backup_path=backup_path,
        apply=bool(args.apply),
        report_path=report_path,
        make_safety_backup=not bool(args.no_safety_backup),
    )

    print(
        "[mount-restore]",
        f"user={result['user_id']}",
        f"errors={result['current_error_count']}",
        f"matched={result['backup_match_count']}",
        f"mismatch={result['mount_mismatch_count']}",
        f"applied={result['applied_count']}",
        f"report={report_path}",
    )


if __name__ == "__main__":
    main()
