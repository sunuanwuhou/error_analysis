#!/usr/bin/env python
"""分析数据库并输出到文件"""
import json
from app.database import get_conn

output = []

try:
    with get_conn() as conn:
        output.append("=" * 60)
        output.append("数据库分析报告")
        output.append("=" * 60)

        # 用户统计
        output.append("\n【用户统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM users").fetchone()
        output.append(f"用户总数: {result['count']}")

        users = conn.execute(
            "SELECT id, username, created_at FROM users ORDER BY created_at DESC LIMIT 10"
        ).fetchall()
        output.append(f"\n最近注册的用户 (前10):")
        for u in users:
            output.append(f"  {u['username']} | ID: {u['id'][:8]}... | {u['created_at']}")

        # 练习统计
        output.append("\n【练习统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM practice_attempts").fetchone()
        output.append(f"练习记录总数: {result['count']}")

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
        output.append(f"\n练习最多的用户 (前10):")
        for u in top_users:
            acc = (u['correct_cnt'] / u['cnt'] * 100) if u['cnt'] > 0 else 0
            output.append(f"  {u['username']}: {u['cnt']}次 (正确率: {acc:.1f}%)")

        # 最近练习
        recent = conn.execute("""
            SELECT pa.created_at, u.username, pa.result, pa.question_text
            FROM practice_attempts pa
            JOIN users u ON pa.user_id = u.id
            ORDER BY pa.created_at DESC
            LIMIT 5
        """).fetchall()
        output.append(f"\n最近的练习记录 (前5):")
        for r in recent:
            q_text = r['question_text'][:50] + '...' if len(r['question_text']) > 50 else r['question_text']
            output.append(f"  [{r['created_at']}] {r['username']} - {r['result']} - {q_text}")

        # 云备份统计
        output.append("\n【云备份统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM user_backups").fetchone()
        output.append(f"已备份用户数: {result['count']}")

        backups = conn.execute("""
            SELECT ub.user_id, u.username, ub.updated_at, LENGTH(ub.payload_json) as size
            FROM user_backups ub
            JOIN users u ON ub.user_id = u.id
            ORDER BY ub.updated_at DESC
            LIMIT 10
        """).fetchall()
        output.append(f"\n最近备份记录 (前10):")
        for b in backups:
            output.append(f"  {b['username']} | {b['updated_at']} | 大小: {b['size']/1024:.1f}KB")

        # 图片统计
        output.append("\n【图片统计】")
        result = conn.execute("""
            SELECT COUNT(*) as count,
                   COALESCE(SUM(size_bytes), 0) as total_size,
                   COALESCE(SUM(ref_count), 0) as total_refs
            FROM user_images
        """).fetchone()
        output.append(f"图片总数: {result['count']}")
        output.append(f"总大小: {result['total_size'] / 1024 / 1024:.2f} MB")
        output.append(f"总引用数: {result['total_refs']}")

        # 同步统计
        output.append("\n【同步统计】")
        result = conn.execute("SELECT COUNT(*) as count FROM user_origin_status").fetchone()
        output.append(f"同步状态记录数: {result['count']}")

        origins = conn.execute("""
            SELECT origin, COUNT(*) as cnt
            FROM user_origin_status
            GROUP BY origin
            ORDER BY cnt DESC
        """).fetchall()
        output.append(f"\n按设备统计:")
        for o in origins:
            output.append(f"  {o['origin']}: {o['cnt']} 个用户")

        # 操作日志统计
        result = conn.execute("SELECT COUNT(*) as count FROM operations").fetchone()
        output.append(f"\n操作日志总数: {result['count']}")

        op_types = conn.execute("""
            SELECT op_type, COUNT(*) as cnt
            FROM operations
            GROUP BY op_type
            ORDER BY cnt DESC
            LIMIT 10
        """).fetchall()
        output.append(f"\n操作类型分布 (前10):")
        for op in op_types:
            output.append(f"  {op['op_type']}: {op['cnt']} 次")

        # 状态实体统计
        output.append("\n【状态实体统计】")
        entities = conn.execute("""
            SELECT entity_type,
                   COUNT(*) as total,
                   SUM(CASE WHEN deleted_at = '' THEN 1 ELSE 0 END) as active
            FROM state_entities
            GROUP BY entity_type
            ORDER BY total DESC
        """).fetchall()
        output.append(f"\n实体类型分布:")
        for e in entities:
            output.append(f"  {e['entity_type']}: {e['active']}/{e['total']} (活跃/总数)")

        output.append("\n" + "=" * 60)
        output.append("分析完成")
        output.append("=" * 60)

except Exception as e:
    output.append(f"\n错误: {str(e)}")
    import traceback
    output.append(traceback.format_exc())

# 写入文件
with open('db_analysis_report.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("报告已生成: db_analysis_report.txt")
