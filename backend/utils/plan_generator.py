"""
AI学习计划生成器
使用 DeepSeek（或其他配置的模型）生成结构化学习计划
"""
import json
import re
from typing import Optional, List, Dict
from utils.openai_client import get_provider_config, get_api_config
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()


SYSTEM_PROMPT = """你是智学伴，一个AI个性化学习与测评助手，由智学伴项目团队开发。

你的任务是帮助用户生成个性化的学习计划。请根据用户的学习目标和提供的教材内容，生成详细、可执行的学习计划。

要求：
1. 生成3~7天的学习计划（根据目标难度调整天数）
2. 每天包含一个主题和多个具体任务
3. 任务要具体、可执行
4. 输出格式必须是有效的JSON数组
5. 不要包含任何Markdown格式符号（如```json、```等）
6. 直接输出JSON，不要有其他说明文字

输出格式示例：
[
  {"day": 1, "topic": "基础语法", "tasks": ["学习变量与数据类型", "掌握if语句", "练习条件判断"]},
  {"day": 2, "topic": "循环语句", "tasks": ["学习for循环", "学习while循环", "完成循环练习题"]},
  {"day": 3, "topic": "函数定义", "tasks": ["理解函数概念", "学习函数定义语法", "练习编写函数"]}
]"""


def generate_study_plan(user_id: int, goals: str = "", file_text: Optional[str] = None, provider: Optional[str] = None) -> List[Dict]:
    """
    生成学习计划
    
    Args:
        user_id: 用户ID
        goals: 用户学习目标（可选，例如："三天掌握Python基础"）
        file_text: 上传文件的文本内容（可选）
        provider: AI模型提供商（可选，默认使用.env配置）
        
    Returns:
        List[Dict]: 学习计划列表，每个元素包含 day, topic, tasks
    """
    # 构建用户提示
    if goals and goals.strip():
        # 如果提供了学习目标
        user_prompt = f"请根据以下学习目标生成学习计划：\n\n学习目标：{goals.strip()}\n\n"
    else:
        # 如果没有提供学习目标，根据文件内容生成
        user_prompt = "请根据提供的教材内容生成学习计划。\n\n"
    
    if file_text:
        # 限制文件文本长度，避免超出token限制
        max_text_length = 3000
        if len(file_text) > max_text_length:
            file_text = file_text[:max_text_length] + "\n\n[内容已截断...]"
        user_prompt += f"教材内容摘要：\n{file_text}\n\n"
    elif not goals or not goals.strip():
        # 如果既没有学习目标也没有文件内容，提示错误
        raise ValueError("请至少提供学习目标或上传教材文件")
    
    user_prompt += "请生成详细的学习计划，输出JSON格式。"
    
    # 调用AI生成计划（使用自定义system prompt）
    try:
        # 如果未指定provider，使用配置文件中的默认值
        if provider is None:
            provider = get_provider_config()
        elif provider not in ["deepseek", "wenxin", "xinghuo", "chatglm", "moonshot"]:
            provider = get_provider_config()
        
        config = get_api_config(provider)
        
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError(f"错误：未配置 {provider.upper()}_API_KEY，请在 .env 文件中设置")
        
        base_url = config.get("base_url")
        model = config.get("model")
        provider_name = config.get("provider_name", provider)
        
        # 创建 OpenAI 客户端
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 调用 AI 模型（使用自定义system prompt）
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=2000,
            temperature=0.7,
        )
        
        # 提取返回内容
        response_text = response.choices[0].message.content
        
        # 清理响应内容，提取JSON
        plan_json = clean_and_extract_json(response_text)
        
        # 解析JSON
        plan_data = json.loads(plan_json)
        
        # 验证数据结构
        if not isinstance(plan_data, list):
            raise ValueError("AI返回的不是数组格式")
        
        # 验证每个元素的结构
        for item in plan_data:
            if not isinstance(item, dict):
                raise ValueError("计划项必须是对象")
            if "day" not in item or "topic" not in item or "tasks" not in item:
                raise ValueError("计划项缺少必要字段：day, topic, tasks")
        
        return plan_data
        
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {str(e)}，原始响应: {response_text[:200] if 'response_text' in locals() else 'N/A'}")
    except Exception as e:
        raise ValueError(f"生成学习计划失败: {str(e)}")


def clean_and_extract_json(text: str) -> str:
    """
    清理AI响应，提取JSON内容
    
    Args:
        text: AI原始响应
        
    Returns:
        str: 清理后的JSON字符串
    """
    # 移除Markdown代码块标记
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    
    # 查找JSON数组的开始和结束
    start_idx = text.find('[')
    end_idx = text.rfind(']')
    
    if start_idx == -1 or end_idx == -1:
        raise ValueError("无法在响应中找到JSON内容")
    
    json_str = text[start_idx:end_idx + 1]
    
    # 清理多余的空白字符
    json_str = json_str.strip()
    
    return json_str

