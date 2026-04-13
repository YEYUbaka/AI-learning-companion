"""
通过注册接口批量创建测试用户。

用法：
    python docs/backend_register_users.py --password "TempPass!9"

说明：
    1. 脚本不内置任何真实密码。
    2. 这里的默认账号仅为占位模板，执行前请按环境实际情况调整。
    3. 注册接口默认创建普通用户；如需管理员，请在后台或数据库中单独授权。
"""
import argparse
from typing import List, Dict

import requests


DEFAULT_USERS: List[Dict[str, str]] = [
    {"email": "admin@example.com", "name": "管理员"},
    {"email": "teacher@example.com", "name": "教师示例"},
    {"email": "student1@example.com", "name": "学生示例1"},
    {"email": "student2@example.com", "name": "学生示例2"},
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="通过注册接口批量创建测试用户")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="后端服务地址，默认 http://127.0.0.1:8000",
    )
    parser.add_argument(
        "--password",
        required=True,
        help="运行时提供统一密码，不会写入仓库",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    register_url = f"{args.base_url.rstrip('/')}/api/v1/auth/register"

    print("=" * 60)
    print("开始批量创建测试用户")
    print("=" * 60)

    for user in DEFAULT_USERS:
        payload = {
            "email": user["email"],
            "name": user["name"],
            "password": args.password,
        }
        try:
            response = requests.post(
                register_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15,
            )
            if response.ok:
                print(f"[OK] 已创建用户: {user['email']}")
            else:
                print(f"[FAIL] 创建失败: {user['email']} -> {response.text}")
        except Exception as error:
            print(f"[FAIL] 请求异常: {user['email']} -> {error}")

    print("=" * 60)
    print("[INFO] 统一密码由命令行参数提供，未写入任何文档或日志模板")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
