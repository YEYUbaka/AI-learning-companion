"""
测试星火API的不同模型名称
运行方式：python test_xinghuo_models.py

注意：需要在虚拟环境中运行
在 backend 目录下运行：
  .\venv\Scripts\activate
  python test_xinghuo_models.py
"""
import os
import sys

# 检查是否在虚拟环境中
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    venv_python = os.path.join(os.path.dirname(__file__), 'venv', 'Scripts', 'python.exe')
    if os.path.exists(venv_python):
        print("⚠️  检测到未在虚拟环境中运行")
        print(f"请使用以下命令运行：")
        print(f"  {venv_python} {__file__}")
        print("\n或者先激活虚拟环境：")
        print("  .\\venv\\Scripts\\activate")
        print("  python test_xinghuo_models.py")
        sys.exit(1)

try:
    from dotenv import load_dotenv  # type: ignore
    from openai import OpenAI  # type: ignore
except ImportError as e:
    print(f"❌ 导入错误: {e}")
    print("请确保在虚拟环境中运行，并已安装依赖：")
    print("  .\\venv\\Scripts\\activate")
    print("  pip install -r requirements.txt")
    sys.exit(1)

load_dotenv()

# 获取星火API配置
api_key = os.getenv("XINGHUO_API_KEY")
base_url = os.getenv("XINGHUO_API_BASE_URL", "https://spark-api-open.xf-yun.com/v2/")

if not api_key:
    print("❌ 未配置 XINGHUO_API_KEY")
    exit(1)

print("=" * 60)
print("测试星火API模型名称")
print("=" * 60)
print(f"Base URL: {base_url}")
print(f"API Key: {api_key[:10]}...{api_key[-10:]}")
print()

# 常见的星火模型名称列表
test_models = [
    "generalv3.5",
    "generalv3",
    "general",
    "x1",
    "4.0Ultra",
    "spark-3.5",
    "spark-4.0",
    "spark-lite",
    "spark",
    "general-v3.5",
    "general-v3",
]

client = OpenAI(
    api_key=api_key,
    base_url=base_url
)

print("开始测试模型名称...\n")

for model in test_models:
    try:
        print(f"测试模型: {model:20}", end=" ... ")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "你好"}
            ],
            max_tokens=10,
        )
        print("✅ 成功！")
        print(f"   响应: {response.choices[0].message.content[:50]}...")
        print(f"\n🎉 找到可用的模型名称: {model}")
        break
    except Exception as e:
        error_msg = str(e)
        if "invalid_model" in error_msg or "model" in error_msg.lower():
            print("❌ 模型不存在")
        elif "401" in error_msg or "unauthorized" in error_msg.lower():
            print("❌ 认证失败")
        else:
            print(f"❌ 错误: {error_msg[:50]}...")
    print()

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)

