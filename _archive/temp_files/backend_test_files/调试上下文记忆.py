"""
调试上下文记忆功能
模拟完整的请求处理流程
"""
import json
from typing import Optional

# 模拟前端发送的数据
test_request = {
    "prompt": "B",
    "provider": "deepseek",
    "history": [
        {"role": "user", "content": "出几个王者荣耀题目"},
        {"role": "assistant", "content": "好的，这里有几道题..."}
    ]
}

print("=" * 60)
print("模拟上下文记忆处理流程")
print("=" * 60)
print(f"原始请求: {json.dumps(test_request, ensure_ascii=False, indent=2)}")
print()

# 模拟后端处理
history = test_request.get("history", [])
prompt = test_request.get("prompt", "")

# 构建消息列表
messages = [{"role": "system", "content": "你是智学伴..."}]

print("处理历史消息:")
if history:
    for i, msg in enumerate(history):
        if isinstance(msg, dict):
            role = msg.get("role", "user")
            content = msg.get("content", "")
        else:
            role = getattr(msg, "role", "user")
            content = getattr(msg, "content", "")
        
        # 转换role格式
        if role == "ai":
            role = "assistant"
        elif role not in ["user", "assistant", "system"]:
            role = "user"
        
        if content and content.strip():
            messages.append({"role": role, "content": content.strip()})
            print(f"  [{i+1}] {role}: {content[:50]}...")
else:
    print("  无历史消息")

# 添加当前消息
messages.append({"role": "user", "content": prompt})
print(f"  [当前] user: {prompt}")
print()

print("最终消息列表:")
for i, msg in enumerate(messages):
    print(f"  [{i+1}] {msg['role']}: {msg['content'][:50]}...")
print()
print(f"总消息数: {len(messages)}")
print("=" * 60)

