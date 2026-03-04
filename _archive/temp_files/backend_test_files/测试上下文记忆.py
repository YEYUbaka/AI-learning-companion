"""
测试上下文记忆功能
用于验证对话历史是否正确传递
"""
import json

# 模拟前端发送的数据
test_data = {
    "prompt": "我的答案是D",
    "provider": "deepseek",
    "history": [
        {"role": "user", "content": "出几个王者荣耀英雄技能考考我"},
        {"role": "assistant", "content": "好的！下面给你出5道题..."}
    ]
}

print("=" * 60)
print("测试上下文记忆数据格式")
print("=" * 60)
print(f"请求数据: {json.dumps(test_data, ensure_ascii=False, indent=2)}")
print()

# 模拟后端处理
messages = [{"role": "system", "content": "你是智学伴..."}]

if test_data.get("history"):
    for msg in test_data["history"]:
        role = msg.get("role", "user")
        if role == "ai":
            role = "assistant"
        content = msg.get("content", "")
        if content:
            messages.append({"role": role, "content": content})

messages.append({"role": "user", "content": test_data["prompt"]})

print("构建的消息列表:")
for i, msg in enumerate(messages):
    print(f"  [{i+1}] {msg['role']}: {msg['content'][:50]}...")
print()
print(f"总消息数: {len(messages)}")
print("=" * 60)

