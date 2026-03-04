"""
Markdown清理工具
作者：智学伴开发团队
目的：清理AI返回文本中的模型签名，替换为统一自我介绍
"""
import re


def clean_ai_response(text: str) -> str:
    """
    清理AI响应文本
    移除模型签名，替换为统一自我介绍
    """
    if not text:
        return text
    
    # 统一自我介绍文本
    self_intro = "我是智学伴，一个由全国大学生计算机设计大赛参赛团队开发的 AI 学习助手，不属于任何商业AI公司。"
    
    # 需要替换的模式（模型签名）
    patterns = [
        r"我是\s*DeepSeek[^。，]*[。，]?",
        r"我是\s*deepseek[^。，]*[。，]?",
        r"我是\s*通义千问[^。，]*[。，]?",
        r"我是\s*Qwen[^。，]*[。，]?",
        r"我是\s*ChatGLM[^。，]*[。，]?",
        r"我是\s*GLM[^。，]*[。，]?",
        r"我是\s*星火[^。，]*[。，]?",
        r"我是\s*讯飞[^。，]*[。，]?",
        r"我是\s*[A-Za-z]+[^。，]*AI[^。，]*[。，]?",
    ]
    
    cleaned_text = text
    for pattern in patterns:
        cleaned_text = re.sub(pattern, self_intro, cleaned_text, flags=re.IGNORECASE)
    
    return cleaned_text

