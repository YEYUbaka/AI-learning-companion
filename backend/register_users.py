import requests
import json

# 测试用户列表
test_users = [
    {"email": "admin@test.com", "name": "管理员", "password": "admin123"},
    {"email": "teacher@test.com", "name": "张老师", "password": "teacher123"},
    {"email": "student1@test.com", "name": "李同学", "password": "student123"},
    {"email": "student2@test.com", "name": "王同学", "password": "student123"},
    {"email": "test@test.com", "name": "测试用户", "password": "test123"}
]

print("="*60)
print("开始创建测试账号")
print("="*60)

for user in test_users:
    try:
        response = requests.post(
            "http://localhost:8000/api/v1/auth/register",
            json=user,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"✓ 成功创建: {user['name']} ({user['email']})")
        else:
            print(f"✗ 创建失败: {user['email']} - {response.text}")
    except Exception as e:
        print(f"✗ 错误: {user['email']} - {str(e)}")

print("\n" + "="*60)
print("测试账号信息")
print("="*60)
for user in test_users:
    print(f"\n姓名: {user['name']}")
    print(f"邮箱: {user['email']}")
    print(f"密码: {user['password']}")
    print("-"*60)
