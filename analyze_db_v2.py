#!/usr/bin/env python
"""分析数据库并输出到文件 - 强制刷新版本"""
import sys
import json
from app.database import get_conn

# 强制输出到文件
output_file = open('db_report.txt', 'w', encoding='utf-8', buffering=1)

def log(msg):
    output_file.write(msg + '\n')
    output_file.flush()

try:
    log("=" * 60)
    log("数据库分析报告")
    log("=" * 60)

    with get_conn() as conn:
        # 用户统计
        log("\n【用户统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM users").fetchone()
        log(f"用户总数: {result['count']}")

        users = conn.execute(
            "SELECT id, username, created_at FROM users ORDER BY created_at DESC LIMIT 10"
        ).fetchall()
        log(f"\n最近注册的用户 (前10):")
        for u in users:
            log(f"  {u['username']} | ID: {u['id'][:8]}... | {u['created_at']}")

        # 练习统计
        log("\n【练习统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM practice_attempts").fetchone()
        log(f"练习记录总数: {result['count']}")

        # 按用户统计
        top_users = conn.execute("""
            SELECT u.username, COUNT(pa.id) as cnt,
                   SUM(CASE WHEN pa.result = 'correct' THEN 1 ELSE 0 END) as correct_cnt
            FROM users u
            LEFT JOIN practice_attempts pa ON u.id = pa.user_id
            GROUP BY u.id, u.username
            HAVING COUNT(pa.id) > 0
            ORDER BY cnt DESC
            LIMIT 10
        """).fetchall()
        log(f"\n练习最多的用户 (前10):")
        for u in top_users:
            acc = (u['correct_cnt'] / u['cnt'] * 100) if u['cnt'] > 0 else 0
            log(f"  {u['username']}: {u['cnt']}次 (正确率: {acc:.1f}%)")

        # 最近练习
        recent = conn.execute("""
            SELECT pa.created_at, u.username, pa.result, pa.question_text
            FROM practice_attempts pa
            JOIN users u ON pa.user_id = u.id
            ORDER BY pa.created_at DESC
            LIMIT 5
        """).fetchall()
        log(f"\n最近的练习记录 (前5):")
        for r in recent:
            q_text = r['question_text'][:50] + '...' if len(r['question_text']) > 50 else r['question_text']
            log(f"  [{r['created_at']}] {r['username']} - {r['result']} - {q_text}")

        # 云备份统计
        log("\n【云备份统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM user_backups").fetchone()
        log(f"已备份用户数: {result['count']}")

        backups = conn.execute("""
            SELECT ub.user_id, u.username, ub.updated_at, LENGTH(ub.payload_json) as size
            FROM user_backups ub
            JOIN users u ON ub.user_id = u.id
            ORDER BY ub.updated_at DESC
            LIMIT 10
        """).fetchall()
        log(f"\n最近备份记录 (前10):")
        for b in backups:
            log(f"  {b['username']} | {b['updated_at']} | 大小: {b['size']/1024:.1f}KB")

        # 图片统计
        log("\n【图片统计】")
        result = conn.execute("""
            SELECT COUNT(*) as count,
                   COALESCE(SUM(size_bytes), 0) as total_size,
                   COALESCE(SUM(ref_count), 0) as total_refs
            FROM user_images
        """).fetchone()
        log(f"图片总数: {result['count']}")
        log(f"总大小: {result['total_size'] / 1024 / 1024:.2f} MB")
        log(f"总引用数: {result['total_refs']}")

        # 同步统计
        log("\n【同步统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM user_origin_status").fetchone()
        log(f"同步状态记录数: {result['count']}")

        origins = conn.execute("""
            SELECT origin, COUNT(*) as cnt
            FROM user_origin_status
            GROUP BY origin
            ORDER BY cnt DESC
        """).fetchall()
        log(f"\n按设备统计:")
        for o in origins:
            log(f"  {o['origin']}: {o['cnt']} 个用户")

        # 操作日志统计
        result = conn.execute("SELECT COUNT(*) as count FROM operations").fetchone()
        log(f"\n操作日志总数: {result['count']}")

        op_types = conn.execute("""
            SELECT op_type, COUNT(*) as cnt
            FROM operations
            GROUP BY op_type
            ORDER BY cnt DESC
            LIMIT 10
        """).fetchall()
        log(f"\n操作类型分布 (前10):")
        for op in op_types:
            log(f"  {op['op_type']}: {op['cnt']} 次")

        # 状态实体统计
        log("\n【状态实体统计】")
        entities = conn.execute("""
            SELECT entity_type,
                   COUNT(*) as total,
                   SUM(CASE WHEN deleted_at = '' THEN 1 ELSE 0 END) as active
            FROM state_entities
            GROUP BY entity_type
            ORDER BY total DESC
        """).fetchall()
        log(f"\n实体类型分布:")
        for e in entities:
            log(f"  {e['entity_type']}: {e['active']}/{e['total']} (活跃/总数)")

        log("\n" + "=" * 60)
        log("分析完成")
        log("=" * 60)

except Exception as e:
    log(f"\n错误: {str(e)}")
    import traceback
    log(traceback.format_exc())

finally:
    output_file.close()
