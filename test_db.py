import os
import sys

# 测试环境
print("Python version:", sys.version)
print("Current dir:", os.getcwd())
print("DATABASE_URL:", os.getenv("DATABASE_URL", "not set"))

# 尝试导入
try:
    from app.database import get_conn
    print("✓ 成功导入 get_conn")

    # 尝试连接
    with get_conn() as conn:
        print("✓ 数据库连接成功")

        # 简单查询
        result = conn.execute("SELECT COUNT(*) FROM users").fetchone()
        print(f"✓ 用户数量: {result[0]}")

        result = conn.execute("SELECT COUNT(*) FROM practice_attempts").fetchone()
        print(f"✓ 练习记录: {result[0]}")

except Exception as e:
    print(f"✗ 错误: {e}")
    import traceback
    traceback.print_exc()
