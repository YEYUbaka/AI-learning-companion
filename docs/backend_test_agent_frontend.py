"""
Agent 前端联调脚本。

使用前请先设置：
    DOCS_TEST_PASSWORD=你的测试密码

可选：
    DOCS_TEST_EMAIL=test@example.com
"""
import io
import os
import sys
import time

import requests


sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"
TOKEN = None
TEST_EMAIL = os.getenv("DOCS_TEST_EMAIL", "test@example.com")
TEST_PASSWORD = os.getenv("DOCS_TEST_PASSWORD")

if not TEST_PASSWORD:
    raise RuntimeError("请先设置 DOCS_TEST_PASSWORD 环境变量")


def login():
    global TOKEN

    payload = {
        "username": TEST_EMAIL,
        "password": TEST_PASSWORD,
    }

    try:
        response = requests.post(f"{BASE_URL}/api/v1/auth/login", data=payload, timeout=15)
        if response.status_code == 200:
            result = response.json()
            TOKEN = result.get("access_token")
            print("[OK] 登录成功")
            return True

        print("[INFO] 测试账号不存在，尝试注册...")
        register_payload = {
            "name": "测试用户",
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        }
        reg_response = requests.post(
            f"{BASE_URL}/api/v1/auth/register",
            json=register_payload,
            timeout=15,
        )
        if reg_response.status_code in [200, 201]:
            print("[OK] 注册成功，重新登录")
            time.sleep(0.5)
            return login()
        if "已被注册" in reg_response.text:
            print("[WARNING] 账号已存在但登录失败，请检查 DOCS_TEST_PASSWORD")
            return False

        print(f"[FAIL] 注册失败: {reg_response.status_code} - {reg_response.text}")
        return False
    except Exception as error:
        print(f"[FAIL] 登录失败: {error}")
        return False


def get_headers():
    if TOKEN:
        return {"Authorization": f"Bearer {TOKEN}"}
    return {}


def run_agent_case(goal: str):
    response = requests.post(
        f"{BASE_URL}/api/agent/task",
        json={"goal": goal, "mode": "react"},
        headers=get_headers(),
        timeout=60,
    )
    if response.status_code != 200:
        print(f"[FAIL] Agent 请求失败: {response.status_code} - {response.text}")
        return None

    result = response.json()
    print(f"[OK] Agent 请求成功，状态: {result.get('status')}")
    print(f"[INFO] 步骤数: {len(result.get('steps', []))}")
    return result


def main():
    print("=" * 60)
    print("Agent 前端联调测试")
    print("=" * 60)

    try:
        health = requests.get(f"{BASE_URL}/health", timeout=5)
        if health.status_code != 200:
            print("[FAIL] 后端健康检查失败")
            return
        print("[OK] 后端服务正常")
    except Exception as error:
        print(f"[FAIL] 无法连接后端: {error}")
        return

    if not login():
        print("[FAIL] 登录失败，测试终止")
        return

    run_agent_case("搜索 Python 异步编程教程")
    time.sleep(1)
    run_agent_case("帮我生成一个 7 天的 Python 学习计划")
    time.sleep(1)
    run_agent_case("什么是 Python")

    print("=" * 60)
    print("[OK] 联调脚本执行完成")
    print(f"[INFO] 如需继续手动验证，请访问 {BASE_URL}/docs 和 http://127.0.0.1:5173/agent")


if __name__ == "__main__":
    main()
