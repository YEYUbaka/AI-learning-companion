"""
PDF学习报告生成器
使用 ReportLab 生成学习成长报告
"""
import os
import platform
import logging
from datetime import datetime
from reportlab.lib.pagesizes import A4  # pyright: ignore[reportMissingModuleSource]
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak  # pyright: ignore[reportMissingModuleSource]
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # pyright: ignore[reportMissingModuleSource]
from reportlab.lib.units import inch  # pyright: ignore[reportMissingModuleSource]
from reportlab.lib import colors  # pyright: ignore[reportMissingModuleSource]
from reportlab.pdfbase import pdfmetrics  # pyright: ignore[reportMissingModuleSource]
from reportlab.pdfbase.ttfonts import TTFont  # pyright: ignore[reportMissingModuleSource]
from sqlalchemy.orm import Session  # pyright: ignore[reportMissingImports]
from database import SessionLocal
from models.quizzes import Quiz
from models.study_plans import StudyPlan
import json

# 配置日志 - 同时使用logger和print确保输出
logger = logging.getLogger(__name__)
# 确保日志能正常输出
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# 辅助函数：同时输出到logger和print
def log_info(msg):
    """同时输出到logger和print"""
    logger.info(msg)
    print(msg, flush=True)

def log_warning(msg):
    """同时输出到logger和print"""
    logger.warning(msg)
    print(msg, flush=True)

def log_error(msg):
    """同时输出到logger和print"""
    logger.error(msg)
    print(msg, flush=True)

# 全局字体注册标志
_font_registered = False
_registered_font_name = None

# 注册中文字体
def register_chinese_fonts(force_reregister=False):
    """注册中文字体，支持中文显示
    
    Args:
        force_reregister: 是否强制重新注册字体
    """
    global _font_registered, _registered_font_name
    
    # 如果字体已注册且不强制重新注册，直接返回
    if _font_registered and not force_reregister and _registered_font_name:
        if _registered_font_name in pdfmetrics.getRegisteredFontNames():
            log_info(f"✅ 使用已注册的字体: {_registered_font_name}")
            return _registered_font_name
    
    system = platform.system()
    
    # 尝试注册中文字体（优先使用TTF文件，TTC文件可能有问题）
    font_paths = []
    
    if system == "Windows":
        # Windows系统字体路径
        # 优先使用TTF字体（确保字体正确嵌入PDF）
        # 注意：不使用CID字体优先，因为CID字体可能不会正确嵌入到PDF中
        font_paths = [
            # 优先使用TTF文件（确保字体正确嵌入）
            ("C:/Windows/Fonts/simhei.ttf", "SimHei"),  # 黑体 - TTF文件（推荐）
            ("C:/Windows/Fonts/simkai.ttf", "SimKai"),  # 楷体 - TTF文件
            ("C:/Windows/Fonts/simsun.ttc", "SimSun"),  # 宋体 - TTC文件
            ("C:/Windows/Fonts/msyh.ttc", "MicrosoftYaHei"),  # 微软雅黑 - TTC文件
            # 尝试其他可能的字体路径
            ("C:/Windows/Fonts/STSONG.TTF", "STSong"),  # 华文宋体
            ("C:/Windows/Fonts/STZHONGS.TTF", "STZhongsong"),  # 华文中宋
        ]
    elif system == "Darwin":  # macOS
        font_paths = [
            ("/System/Library/Fonts/PingFang.ttc", "PingFang"),
            ("/System/Library/Fonts/STHeiti Light.ttc", "STHeiti"),
        ]
    elif system == "Linux":
        font_paths = [
            ("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", "WQY"),
            ("/usr/share/fonts/truetype/arphic/uming.ttc", "ARPLUMing"),
        ]
    
    # 注册找到的第一个可用字体
    registered_font = None
    for font_path, font_name in font_paths:
        try:
            # 优先尝试CID字体
            if font_path == "CID":
                try:
                    from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # pyright: ignore[reportMissingModuleSource]
                    # 检查字体是否已经注册
                    if font_name in pdfmetrics.getRegisteredFontNames():
                        registered_font = font_name
                        log_info(f"✅ CID字体已注册: {font_name}")
                        break
                    # 注册CID字体
                    pdfmetrics.registerFont(UnicodeCIDFont(font_name))
                    registered_font = font_name
                    log_info(f"✅ 成功注册CID中文字体: {font_name}（推荐使用）")
                    break
                except Exception as e:
                    log_warning(f"⚠️ CID字体注册失败 {font_name}: {e}，尝试下一个字体")
                    continue
            
            # 检查字体文件是否存在
            if not os.path.exists(font_path):
                continue
                
            # 检查字体是否已经注册
            if font_name in pdfmetrics.getRegisteredFontNames():
                registered_font = font_name
                log_info(f"✅ 字体已注册: {font_name}")
                break
            
            # 检查文件扩展名，TTC文件可能需要特殊处理
            if font_path.lower().endswith('.ttc'):
                # TTC文件是字体集合，尝试直接加载
                # 如果失败，跳过这个字体
                try:
                    font = TTFont(font_name, font_path)
                    pdfmetrics.registerFont(font)
                    registered_font = font_name
                    log_info(f"✅ 成功注册中文字体: {font_name} ({font_path})")
                    break
                except Exception as e:
                    log_warning(f"⚠️ TTC字体注册失败 {font_name}: {e}，尝试下一个字体")
                    continue
            else:
                # TTF文件直接注册（确保字体正确嵌入）
                try:
                    font = TTFont(font_name, font_path)
                    # 确保字体正确嵌入到PDF中
                    # TTFont默认会嵌入字体，但我们需要确保它正确工作
                    pdfmetrics.registerFont(font)
                    registered_font = font_name
                    log_info(f"✅ 成功注册中文字体: {font_name} ({font_path})")
                    log_info(f"📝 字体对象: {font}")
                    log_info(f"📝 字体名称: {font.face.name if hasattr(font, 'face') else 'N/A'}")
                    # 验证字体是否真的注册成功
                    if font_name in pdfmetrics.getRegisteredFontNames():
                        log_info(f"✅ 字体 {font_name} 已确认注册成功")
                    else:
                        log_error(f"❌ 字体 {font_name} 注册失败！")
                    break
                except Exception as e:
                    log_warning(f"⚠️ TTF字体注册失败 {font_name}: {e}，尝试下一个字体")
                    import traceback
                    log_error(traceback.format_exc())
                    continue
        except Exception as e:
            log_warning(f"⚠️ 注册字体失败 {font_name}: {e}")
            import traceback
            log_error(traceback.format_exc())
            continue
    
    # 优先使用CID字体（更适合中文显示）
    # 如果没有找到系统字体，尝试使用reportlab内置的CID字体
    if not registered_font:
        try:
            # 使用reportlab的CID字体（支持中文，推荐）
            from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # pyright: ignore[reportMissingModuleSource]
            pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))  # 华文宋体
            registered_font = "STSong-Light"
            log_info("✅ 使用ReportLab内置中文字体: STSong-Light（CID字体，推荐）")
        except Exception as e:
            log_warning(f"⚠️ 无法注册CID字体: {e}")
            # 最后尝试使用UnicodeCIDFont的其他字体
            try:
                from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # pyright: ignore[reportMissingModuleSource]
                pdfmetrics.registerFont(UnicodeCIDFont("STSongStd-Light"))
                registered_font = "STSongStd-Light"
                log_info("✅ 使用ReportLab内置中文字体: STSongStd-Light")
            except Exception as e2:
                log_error(f"❌ 无法注册任何中文字体，将使用Helvetica（中文可能显示为乱码）: {e2}")
                registered_font = "Helvetica"  # 回退到默认字体
    
    if not registered_font:
        registered_font = "Helvetica"
    
    # 更新全局变量
    _font_registered = True
    _registered_font_name = registered_font
    
    logger.info(f"[字体注册] 最终使用的字体: {registered_font}")
    return registered_font


def generate_pdf_report(user_id: int) -> str:
    """
    生成用户学习成长报告PDF
    
    Args:
        user_id: 用户ID
        
    Returns:
        str: PDF文件路径
    """
    db = SessionLocal()
    
    try:
        # 强制重新注册中文字体（确保每次生成PDF时字体都可用）
        chinese_font = register_chinese_fonts(force_reregister=True)
        
        # 验证字体是否已注册
        registered_fonts = pdfmetrics.getRegisteredFontNames()
        log_info(f"📋 已注册的字体列表: {registered_fonts}")
        
        if chinese_font not in registered_fonts:
            log_warning(f"⚠️ 警告: 字体 {chinese_font} 未在已注册字体列表中！")
            # 尝试重新注册
            try:
                if chinese_font == "SimHei":
                    font = TTFont("SimHei", "C:/Windows/Fonts/simhei.ttf")
                    pdfmetrics.registerFont(font)
                    log_info(f"✅ 重新注册字体成功: {chinese_font}")
                elif chinese_font == "SimKai":
                    font = TTFont("SimKai", "C:/Windows/Fonts/simkai.ttf")
                    pdfmetrics.registerFont(font)
                    log_info(f"✅ 重新注册字体成功: {chinese_font}")
                elif chinese_font == "STSong-Light":
                    from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # pyright: ignore[reportMissingModuleSource]
                    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
                    log_info(f"✅ 重新注册CID字体成功: {chinese_font}")
            except Exception as e:
                log_error(f"❌ 重新注册字体失败: {e}")
                import traceback
                log_error(traceback.format_exc())
        else:
            log_info(f"✅ 字体 {chinese_font} 已正确注册并可用")
        
        # 再次验证字体是否在已注册列表中
        final_registered_fonts = pdfmetrics.getRegisteredFontNames()
        log_info(f"📋 最终已注册字体列表: {final_registered_fonts}")
        
        if chinese_font not in final_registered_fonts:
            log_error(f"❌ 严重错误: 字体 {chinese_font} 仍然未注册！")
            log_error(f"📋 当前已注册字体: {final_registered_fonts}")
            # 强制使用CID字体作为最后手段
            try:
                from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # pyright: ignore[reportMissingModuleSource]
                pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
                chinese_font = "STSong-Light"
                log_info(f"🔄 强制使用CID字体: {chinese_font}")
            except Exception as e:
                log_error(f"❌ 无法使用CID字体: {e}")
                raise ValueError(f"无法注册中文字体，PDF中文将显示为乱码")
        
        # 最终验证：确保字体真的可用
        try:
            test_font = pdfmetrics.getFont(chinese_font)
            if test_font is None:
                log_error(f"❌ 字体 {chinese_font} 注册但无法获取！")
                raise ValueError(f"字体 {chinese_font} 无法使用")
            log_info(f"✅ 字体 {chinese_font} 已验证可用，类型: {type(test_font)}")
        except Exception as e:
            log_error(f"❌ 字体验证失败: {e}")
            raise ValueError(f"字体 {chinese_font} 验证失败: {e}")
        
        # 获取用户数据
        quizzes = db.query(Quiz).filter(Quiz.user_id == user_id).order_by(Quiz.created_at.desc()).all()
        study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).order_by(StudyPlan.created_at.desc()).all()
        
        # 创建报告目录
        reports_dir = "reports"
        os.makedirs(reports_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"智学伴_学习报告_{user_id}_{timestamp}.pdf"
        file_path = os.path.join(reports_dir, filename)
        
        # 创建PDF文档（确保字体嵌入）
        doc = SimpleDocTemplate(
            file_path, 
            pagesize=A4,
            # 确保字体嵌入到PDF中
            title="智学伴学习报告",
            author="智学伴AI学习系统",
            subject="学习成长报告"
        )
        styles = getSampleStyleSheet()
        story = []
        
        # 自定义样式（使用中文字体）
        # 不使用parent样式，直接指定所有属性，避免继承默认字体
        title_style = ParagraphStyle(
            'CustomTitle',
            fontName=chinese_font,  # 直接指定中文字体
            fontSize=24,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=30,
            alignment=1,  # 居中
            encoding='utf-8'  # 确保使用UTF-8编码
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            fontName=chinese_font,  # 直接指定中文字体
            fontSize=16,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=12,
            spaceBefore=12,
            encoding='utf-8'  # 确保使用UTF-8编码
        )
        
        # 创建使用中文字体的普通样式
        # 不使用parent样式，直接指定所有属性，避免继承默认字体
        normal_style = ParagraphStyle(
            'ChineseNormal',
            fontName=chinese_font,  # 直接指定中文字体
            fontSize=12,
            leading=18,
            encoding='utf-8'  # 确保使用UTF-8编码
        )
        
        # 标题
        story.append(Paragraph("智学伴 · 学习成长报告", title_style))
        story.append(Spacer(1, 20))
        
        # 报告信息
        story.append(Paragraph(f"<b>生成日期：</b>{datetime.now().strftime('%Y年%m月%d日 %H:%M')}", normal_style))
        story.append(Paragraph(f"<b>用户ID：</b>{user_id}", normal_style))
        story.append(Spacer(1, 30))
        
        # 一、学习计划统计
        story.append(Paragraph("一、学习计划统计", heading_style))
        if study_plans:
            story.append(Paragraph(f"已生成学习计划：<b>{len(study_plans)}</b> 个", normal_style))
            story.append(Spacer(1, 10))
            
            # 最近的学习计划
            story.append(Paragraph("<b>最近的学习计划：</b>", normal_style))
            for i, plan in enumerate(study_plans[:3], 1):
                story.append(Paragraph(f"{i}. {plan.goal}", normal_style))
                if plan.created_at:
                    story.append(Paragraph(f"   创建时间：{plan.created_at.strftime('%Y-%m-%d %H:%M')}", 
                                         normal_style))
                story.append(Spacer(1, 5))
        else:
            story.append(Paragraph("暂无学习计划，建议上传教材文件生成个性化学习计划。", normal_style))
        
        story.append(Spacer(1, 20))
        
        # 二、测评成绩统计
        story.append(Paragraph("二、测评成绩统计", heading_style))
        if quizzes:
            # 计算统计数据
            scores = [q.score for q in quizzes if q.score is not None]
            avg_score = sum(scores) / len(scores) if scores else 0
            max_score = max(scores) if scores else 0
            min_score = min(scores) if scores else 0
            
            # 统计信息表格
            data = [
                ['统计项', '数值'],
                ['已完成测验', f'{len(quizzes)} 次'],
                ['平均得分', f'{avg_score:.1f} 分'],
                ['最高得分', f'{max_score} 分'],
                ['最低得分', f'{min_score} 分'],
            ]
            
            # 创建表格，使用Paragraph包装中文文本以确保字体正确应用
            # Paragraph已经在文件顶部导入，不需要重复导入
            table_data = []
            for row in data:
                table_row = []
                for cell in row:
                    # 使用Paragraph包装单元格内容，确保使用中文字体
                    para = Paragraph(str(cell), normal_style)
                    table_row.append(para)
                table_data.append(table_row)
            
            table = Table(table_data, colWidths=[3*inch, 3*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TOPPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            
            story.append(table)
            story.append(Spacer(1, 20))
            
            # 最近5次测验记录
            story.append(Paragraph("<b>最近5次测验记录：</b>", normal_style))
            story.append(Spacer(1, 10))
            
            # 创建测验记录表格，使用Paragraph包装中文文本
            quiz_table_data = []
            # 表头
            header_row = [Paragraph(cell, normal_style) for cell in ['序号', '主题', '得分', '日期']]
            quiz_table_data.append(header_row)
            
            # 数据行
            for i, quiz in enumerate(quizzes[:5], 1):
                topic = quiz.topic or "未指定主题"
                score = quiz.score
                date_str = quiz.created_at.strftime('%Y-%m-%d') if quiz.created_at else "未知"
                row = [
                    Paragraph(str(i), normal_style),
                    Paragraph(topic, normal_style),
                    Paragraph(f'{score}分', normal_style),
                    Paragraph(date_str, normal_style)
                ]
                quiz_table_data.append(row)
            
            quiz_table = Table(quiz_table_data, colWidths=[0.8*inch, 2.5*inch, 1*inch, 1.5*inch])
            quiz_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            
            story.append(quiz_table)
            story.append(Spacer(1, 20))
            
            # 弱项分析
            if avg_score < 80:
                story.append(Paragraph("<b>学习建议：</b>", normal_style))
                story.append(Paragraph("根据您的测评成绩，建议加强以下方面的学习：", normal_style))
                story.append(Paragraph("• 多进行练习，巩固基础知识", normal_style))
                story.append(Paragraph("• 针对错题进行重点复习", normal_style))
                story.append(Paragraph("• 制定详细的学习计划，按计划执行", normal_style))
            else:
                story.append(Paragraph("<b>学习评价：</b>", normal_style))
                story.append(Paragraph("您的学习表现优秀！继续保持，可以挑战更高难度的内容。", normal_style))
        else:
            story.append(Paragraph("暂无测评数据，建议完成AI测评以获取学习反馈。", normal_style))
        
        story.append(Spacer(1, 30))
        
        # 三、总结
        story.append(Paragraph("三、总结", heading_style))
        story.append(Paragraph("本报告由智学伴AI学习系统自动生成，旨在帮助您了解学习进度和掌握情况。", normal_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph("建议定期查看学习报告，及时调整学习策略，持续提升学习效果。", normal_style))
        
        story.append(Spacer(1, 40))
        
        # 页脚
        footer_style = ParagraphStyle(
            'Footer',
            fontName=chinese_font,  # 直接指定中文字体
            fontSize=9,
            textColor=colors.grey,
            alignment=1,
            encoding='utf-8'  # 确保使用UTF-8编码
        )
        story.append(Paragraph("由 智学伴 AI个性化学习与测评助手 自动生成", footer_style))
        
        # 生成PDF（确保字体正确嵌入）
        log_info(f"📝 开始构建PDF文档，使用字体: {chinese_font}")
        log_info(f"📝 已注册字体列表: {pdfmetrics.getRegisteredFontNames()}")
        
        # 验证所有样式使用的字体
        log_info(f"📝 标题样式字体: {title_style.fontName}")
        log_info(f"📝 标题样式字体: {heading_style.fontName}")
        log_info(f"📝 普通样式字体: {normal_style.fontName}")
        log_info(f"📝 页脚样式字体: {footer_style.fontName}")
        
        doc.build(story)
        
        log_info(f"✅ PDF文档生成完成: {file_path}")
        log_info(f"📝 请检查PDF文件中的字体是否正确嵌入")
        
        return file_path
        
    except Exception as e:
        raise ValueError(f"生成PDF报告失败: {str(e)}")
    finally:
        db.close()

