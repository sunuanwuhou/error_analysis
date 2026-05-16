import sqlite3


def main() -> None:
    conn = sqlite3.connect("data/xingce.db")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    rows = cur.execute(
        "select user_id, updated_at, length(payload_json) as size from user_backups order by updated_at asc"
    ).fetchall()
    print("user_backups", len(rows))
    for row in rows:
        print(dict(row))

    if rows:
        user_id = rows[0]["user_id"]
        print("uid", user_id)
        stats = cur.execute(
            "select entity_type, count(*) as c from workspace_entities where user_id=? group by entity_type order by entity_type",
            (user_id,),
        ).fetchall()
        for item in stats:
            print(dict(item))
        active_errors = cur.execute(
            "select count(*) as c from workspace_entities where user_id=? and entity_type='error' and deleted_at=''",
            (user_id,),
        ).fetchone()["c"]
        print("active_errors", active_errors)
    conn.close()


if __name__ == "__main__":
    main()
