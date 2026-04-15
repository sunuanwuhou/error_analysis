#!/usr/bin/env python
"""查询数据库统计信息"""
import os
import sys
from app.database import get_conn

def main():
    print("正在连接数据库...")

    try:
        with get_conn() as conn:
            # 用户统计
            result = conn.execute("SELECT COUNT(*) as count FROM users").fetchone()
            user_count = result['count']
            print(f"\n=== 用户统计 ===")
            print(f"用户总数: {user_count}")

            # 最近用户
            users = conn.execute(
                "SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5"
            ).fetchall()
            print(f"\n最近注册的 5 个用户:")
            for u in users:
                print(f"  - {u['username']} (注册时间: {u['created_at']})")

            # 练习记录统计
            result = conn.execute("SELECT COUNT(*) as count FROM practice_attempts").fetchone()
            print(f"\n=== 练习统计 ===")
            print(f"练习记录总数: {result['count']}")

            # 按用户统计练习次数
            top_users = conn.execute("""
                SELECT u.username, COUNT(pa.id) as attempt_count
                FROM users u
                LEFT JOIN practice_attempts pa ON u.id = pa.user_id
                GROUP BY u.id, u.username
                ORDER BY attempt_count DESC
                LIMIT 5
            """).fetchall()
            print(f"\n练习次数最多的用户:")
            for u in top_users:
                print(f"  - {u['username']}: {u['attempt_count']} 次")

            # 云备份统计
            result = conn.execute("SELECT COUNT(*) as count FROM user_backups").fetchone()
            print(f"\n=== 云备份统计 ===")
            print(f"已备份用户数: {result['count']}")

            # 图片统计
            result = conn.execute(
                "SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size FROM user_images"
            ).fetchone()
            print(f"\n=== 图片统计 ===")
            print(f"图片总数: {result['count']}")
            print(f"总大小: {result['total_size'] / 1024 / 1024:.2f} MB")

            # 同步状态统计
            result = conn.execute("SELECT COUNT(*) as count FROM user_origin_status").fetchone()
            print(f"\n=== 同步统计 ===")
            print(f"同步状态记录数: {result['count']}")

            # 操作日志统计
            result = conn.execute("SELECT COUNT(*) as count FROM operations").fetchone()
            print(f"操作日志总数: {result['count']}")

            print("\n✓ 查询完成")

    except Exception as e:
        print(f"❌ 错误: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
