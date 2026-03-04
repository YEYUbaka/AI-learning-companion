"""
快速测试上下文记忆
模拟完整的请求流程
"""
import asyncio
import json
from routers.ai import AIQuestion

async def test():
    # 模拟第一次请求（无历史）
    print("=" * 80)
    print("测试1: 第一次请求（无历史）")
    print("=" * 80)
    q1 = AIQuestion(prompt="出几个王者荣耀题目", provider="deepseek", history=None)
    print(f"prompt: {q1.prompt}")
    print(f"history: {q1.history}")
    print()
    
    # 模拟第二次请求（有历史）
    print("=" * 80)
    print("测试2: 第二次请求（有历史）")
    print("=" * 80)
    history = [
        {"role": "user", "content": "出几个王者荣耀题目"},
        {"role": "assistant", "content": "好的，这里有几道题..."}
    ]
    q2 = AIQuestion(prompt="我的答案是1A 2B 3C", provider="deepseek", history=history)
    print(f"prompt: {q2.prompt}")
    print(f"history数量: {len(q2.history) if q2.history else 0}")
    if q2.history:
        for i, msg in enumerate(q2.history):
            if isinstance(msg, dict):
                print(f"  [{i+1}] {msg.get('role')}: {msg.get('content')[:50]}...")
            else:
                print(f"  [{i+1}] {getattr(msg, 'role')}: {getattr(msg, 'content')[:50]}...")
    print()
    
    # 测试消息构建
    print("=" * 80)
    print("测试3: 消息列表构建")
    print("=" * 80)
    messages = [{"role": "system", "content": "你是智学伴..."}]
    if q2.history:
        for msg in q2.history:
            if isinstance(msg, dict):
                role = msg.get('role', 'user')
                content = msg.get('content', '')
            else:
                role = getattr(msg, 'role', 'user')
                content = getattr(msg, 'content', '')
            if role == 'ai':
                role = 'assistant'
            if content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": q2.prompt})
    
    print(f"最终消息列表（{len(messages)}条）:")
    for i, msg in enumerate(messages):
        print(f"  [{i+1}] {msg['role']}: {msg['content'][:50]}...")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test())

