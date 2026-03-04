"""测试PDF中文显示"""
import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 注册中文字体
def register_font():
    """注册中文字体"""
    font_paths = [
        ("C:/Windows/Fonts/simhei.ttf", "SimHei"),
        ("C:/Windows/Fonts/simkai.ttf", "SimKai"),
    ]
    
    for font_path, font_name in font_paths:
        if os.path.exists(font_path):
            try:
                font = TTFont(font_name, font_path)
                pdfmetrics.registerFont(font)
                print(f"✅ 成功注册字体: {font_name}")
                return font_name
            except Exception as e:
                print(f"❌ 注册字体失败 {font_name}: {e}")
                continue
    
    # 尝试使用CID字体
    try:
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        print("✅ 使用CID字体: STSong-Light")
        return "STSong-Light"
    except Exception as e:
        print(f"❌ CID字体注册失败: {e}")
        return "Helvetica"

# 生成测试PDF
def generate_test_pdf():
    """生成测试PDF"""
    # 注册字体
    chinese_font = register_font()
    print(f"📝 使用的字体: {chinese_font}")
    
    # 检查字体是否已注册
    registered_fonts = pdfmetrics.getRegisteredFontNames()
    print(f"📋 已注册的字体: {registered_fonts}")
    
    if chinese_font not in registered_fonts:
        print(f"❌ 字体 {chinese_font} 未在已注册字体列表中！")
        return False
    
    # 创建PDF
    file_path = "test_chinese.pdf"
    doc = SimpleDocTemplate(file_path, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # 创建使用中文字体的样式
    title_style = ParagraphStyle(
        'TestTitle',
        parent=styles['Title'],
        fontName=chinese_font,
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=30,
        alignment=1
    )
    
    normal_style = ParagraphStyle(
        'TestNormal',
        parent=styles['Normal'],
        fontName=chinese_font,
        fontSize=12,
        leading=18
    )
    
    # 添加中文内容
    story.append(Paragraph("智学伴 · 学习成长报告", title_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph("这是一段中文测试文本。", normal_style))
    story.append(Paragraph("如果这段文字显示正常，说明字体注册成功。", normal_style))
    story.append(Paragraph("如果显示为方块，说明字体有问题。", normal_style))
    
    # 生成PDF
    try:
        doc.build(story)
        print(f"✅ PDF生成成功: {file_path}")
        print(f"📂 文件路径: {os.path.abspath(file_path)}")
        return True
    except Exception as e:
        print(f"❌ PDF生成失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    generate_test_pdf()

