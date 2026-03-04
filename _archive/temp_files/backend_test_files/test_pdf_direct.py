"""直接测试PDF生成和字体注册"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from utils.report_generator import generate_pdf_report

if __name__ == "__main__":
    try:
        print("开始生成PDF报告...")
        result = generate_pdf_report(1)
        print(f"✅ PDF生成成功: {result}")
        print(f"📂 文件路径: {os.path.abspath(result)}")
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()

