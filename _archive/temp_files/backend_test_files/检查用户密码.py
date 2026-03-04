"""
检查用户密码
用于验证用户密码是否正确
"""
import sqlite3
from passlib.context import CryptContext

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 数据库路径
db_path = "zhixueban.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 查询用户
email = "test@example.com"
cursor.execute("SELECT id, email, name, hashed_password, role FROM users WHERE email = ?", (email,))
user = cursor.fetchone()

if not user:
    print(f"❌ 用户 {email} 不存在")
    exit(1)

user_id, user_email, user_name, hashed_password, user_role = user

print("=" * 60)
print("用户信息")
print("=" * 60)
print(f"ID: {user_id}")
print(f"邮箱: {user_email}")
print(f"姓名: {user_name}")
print(f"角色: {user_role}")
print(f"加密密码: {hashed_password[:50]}...")
print()

# 测试密码
test_passwords = ["123456", "password", "test", "admin"]

print("测试密码验证:")
print("-" * 60)
for pwd in test_passwords:
    is_valid = pwd_context.verify(pwd, hashed_password)
    status = "✅ 正确" if is_valid else "❌ 错误"
    print(f"{pwd}: {status}")

print()
print("=" * 60)
print("提示：如果所有密码都不匹配，需要重置密码")
print("=" * 60)

conn.close()

