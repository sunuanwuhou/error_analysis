import os
import psycopg


def scalar(conn, sql):
    with conn.cursor() as cur:
        cur.execute(sql)
        row = cur.fetchone()
        return row[0] if row else None


def main():
    dsn = os.getenv("DATABASE_URL", "postgresql://xingce:xingce_password@postgres:5432/xingce")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select table_name from information_schema.tables where table_schema='public' order by table_name"
            )
            names = [r[0] for r in cur.fetchall()]
            print("tables", names)
        print("users", scalar(conn, "select count(1) from users"))
        print("user_backups", scalar(conn, "select count(1) from user_backups"))
        if "state_entities" in names:
            print("state_entities", scalar(conn, "select count(1) from state_entities"))
        if "operations" in names:
            print("operations", scalar(conn, "select count(1) from operations"))
        with conn.cursor() as cur:
            cur.execute(
                """
                select u.id, u.username,
                       coalesce(e.error_count,0) as error_count,
                       coalesce(b.backup_size,0) as backup_size,
                       b.updated_at as backup_updated_at
                from users u
                left join (
                  select user_id, count(1) as error_count
                  from state_entities
                  where entity_type='error' and coalesce(deleted_at,'')=''
                  group by user_id
                ) e on e.user_id=u.id
                left join (
                  select user_id, length(payload_json) as backup_size, updated_at
                  from user_backups
                ) b on b.user_id=u.id
                order by error_count desc, backup_size desc
                """
            )
            print("users_by_error_count")
            for row in cur.fetchall():
                print(row[0], row[1], "errors=", row[2], "backup_size=", row[3], "backup_at=", row[4])

            cur.execute(
                "select user_id, updated_at from user_backups order by updated_at asc limit 5"
            )
            rows = cur.fetchall()
            print("backup_rows", len(rows))
            for row in rows:
                print("backup", row[0], row[1])
            if rows:
                uid = rows[0][0]
                if "state_entities" in names:
                    cur.execute(
                        "select entity_type, count(1) from state_entities where user_id=%s and coalesce(deleted_at,'')='' group by entity_type order by entity_type",
                        (uid,),
                    )
                    for item in cur.fetchall():
                        print("entity", item[0], item[1])


if __name__ == "__main__":
    main()
