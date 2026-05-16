from app.schemas import LocalBackupRestorePayload
from app.services.backup_service import restore_local_backup_response


def main() -> None:
    user_id = "5759eb632cf113d6b9b47edd"
    backup_id = "manual_20260417_200000_recovered"
    result = restore_local_backup_response(
        user_id,
        LocalBackupRestorePayload(backupId=backup_id, createSafetyBackup=True),
        current_origin="manual_restore_script",
    )
    print("ok", result.get("ok"))
    print("backupId", result.get("backupId"))
    print("updatedAt", result.get("updatedAt"))
    summary = result.get("summary") or {}
    print("summary", summary)


if __name__ == "__main__":
    main()
