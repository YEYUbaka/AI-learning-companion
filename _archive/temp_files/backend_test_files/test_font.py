"""测试中文字体注册"""
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import os

# 测试字体文件
font_paths = [
    ("C:/Windows/Fonts/simhei.ttf", "SimHei"),
    ("C:/Windows/Fonts/simkai.ttf", "SimKai"),
    ("C:/Windows/Fonts/simsun.ttc", "SimSun"),
]

for font_path, font_name in font_paths:
    if os.path.exists(font_path):
        try:
            if font_path.lower().endswith('.ttc'):
                # TTC文件测试
                print(f"测试TTC文件: {font_path}")
                try:
                    font = TTFont(font_name, font_path)
                    pdfmetrics.registerFont(font)
                    print(f"✅ {font_name} 注册成功 (TTC)")
                except Exception as e:
                    print(f"❌ {font_name} 注册失败: {e}")
            else:
                # TTF文件测试
                print(f"测试TTF文件: {font_path}")
                font = TTFont(font_name, font_path)
                pdfmetrics.registerFont(font)
                print(f"✅ {font_name} 注册成功 (TTF)")
                break
        except Exception as e:
            print(f"❌ {font_name} 注册失败: {e}")
    else:
        print(f"⚠️ 字体文件不存在: {font_path}")

