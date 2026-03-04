"""
测试应用启动
用于检查所有依赖是否正确安装
"""
import sys

print("=" * 60)
print("检查依赖...")
print("=" * 60)

try:
    import fastapi
    print(f"✅ FastAPI: {fastapi.__version__}")
except ImportError as e:
    print(f"❌ FastAPI: {e}")
    sys.exit(1)

try:
    import pydantic
    print(f"✅ Pydantic: {pydantic.__version__}")
except ImportError as e:
    print(f"❌ Pydantic: {e}")
    sys.exit(1)

try:
    from cryptography.fernet import Fernet
    print("✅ Cryptography: OK")
except ImportError as e:
    print(f"❌ Cryptography: {e}")
    sys.exit(1)

try:
    from PIL import Image
    print(f"✅ Pillow: {Image.__version__}")
except ImportError as e:
    print(f"❌ Pillow: {e}")
    sys.exit(1)

try:
    from reportlab.platypus import SimpleDocTemplate
    print("✅ ReportLab: OK")
except ImportError as e:
    print(f"❌ ReportLab: {e}")
    sys.exit(1)

print("=" * 60)
print("✅ 所有依赖检查通过！")
print("=" * 60)

print("\n尝试导入 main 模块...")
try:
    import main
    print("✅ main.py 导入成功！")
    print("✅ 可以启动服务了：uvicorn main:app --reload --port 8000")
except Exception as e:
    print(f"❌ main.py 导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

