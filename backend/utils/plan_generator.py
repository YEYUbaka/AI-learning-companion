"""
AI学习计划生成器
使用 DeepSeek（或其他配置的模型）生成结构化学习计划
"""
import json
import math
import re
from typing import Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI

from core.config import settings
from utils.openai_client import get_api_config, get_provider_config

load_dotenv()

MAX_PLAN_DAYS = 30

SYSTEM_PROMPT = """你是智学伴，一个AI个性化学习与测评助手，由智学伴项目团队开发。

你的任务是帮助用户生成个性化的学习计划。请根据用户的学习目标和提供的教材内容，生成详细、可执行的学习计划。

要求：
1. 优先遵循学习目标中的时间线索；如果没有明确时间线索，请根据目标难度和教材内容自动判断合理周期
2. 输出必须按“天”组织；如果目标时间跨度过长，请压缩为最多30个关键学习日
3. 分钟或小时级目标按1天处理；天、周、月、年等目标需要换算成合理的按天计划
4. 每天包含一个主题和多个具体任务
5. 任务要具体、可执行
6. 输出格式必须是有效的JSON数组
7. 不要包含任何Markdown格式符号（如```json、```等）
8. 直接输出JSON，不要有其他说明文字

输出格式示例：
[
  {"day": 1, "topic": "基础语法", "tasks": ["学习变量与数据类型", "掌握if语句", "练习条件判断"]},
  {"day": 2, "topic": "循环语句", "tasks": ["学习for循环", "学习while循环", "完成循环练习题"]},
  {"day": 3, "topic": "函数定义", "tasks": ["理解函数概念", "学习函数定义语法", "练习编写函数"]}
]"""


def _parse_number_token(token: str) -> Optional[float]:
    token = (token or "").strip()
    if not token:
        return None

    if re.fullmatch(r"\d+(?:\.\d+)?", token):
        return float(token)

    digit_map = {
        "零": 0,
        "一": 1,
        "二": 2,
        "两": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "半": 0.5,
    }

    if token in digit_map:
        return float(digit_map[token])

    if "十" in token:
        left, right = token.split("十", 1)
        tens = 1 if left == "" else digit_map.get(left)
        ones = 0 if right == "" else digit_map.get(right)
        if tens is not None and ones is not None:
            return float(tens * 10 + ones)

    return None


def infer_duration_days(goals: str = "", max_days: int = MAX_PLAN_DAYS) -> Optional[int]:
    if not goals or not goals.strip():
        return None

    normalized = goals.replace("個", "个").replace("兩", "两")
    # Convert fuzzy natural-language durations to a day count so the generated
    # plan can stay on a single comparable timeline.
    patterns = [
        (r"(?P<num>\d+(?:\.\d+)?|半|[一二两三四五六七八九十]+)\s*(?:个)?\s*(分钟|分鍾|分鐘)", lambda n: 1),
        (r"(?P<num>\d+(?:\.\d+)?|半|[一二两三四五六七八九十]+)\s*(?:个)?\s*(小时|小時)", lambda n: 1),
        (r"(?P<num>\d+(?:\.\d+)?|半|[一二两三四五六七八九十]+)\s*(?:个)?\s*(天|日)", lambda n: n),
        (r"(?P<num>\d+(?:\.\d+)?|半|[一二两三四五六七八九十]+)\s*(?:个)?\s*(周|星期)", lambda n: n * 7),
        (r"(?P<num>\d+(?:\.\d+)?|半|[一二两三四五六七八九十]+)\s*(?:个)?\s*(月|个月)", lambda n: n * 30),
        (r"(?P<num>\d+(?:\.\d+)?|半|[一二两三四五六七八九十]+)\s*(?:个)?\s*(年)", lambda n: n * 365),
    ]

    for pattern, converter in patterns:
        match = re.search(pattern, normalized, re.IGNORECASE)
        if not match:
            continue
        number = _parse_number_token(match.group("num"))
        if number is None:
            continue
        return min(max(1, math.ceil(converter(number))), max_days)

    return None


def build_user_prompt(goals: str = "", file_text: Optional[str] = None, duration_days: Optional[int] = None) -> str:
    inferred_days = duration_days if duration_days is not None else infer_duration_days(goals)

    if goals and goals.strip():
        user_prompt = f"请根据以下学习目标生成学习计划：\n\n学习目标：{goals.strip()}\n"
        if inferred_days is not None:
            user_prompt += f"建议学习周期：{inferred_days} 天（根据目标中的时间表达自动识别；如果原始时间跨度过长，已压缩为关键学习日）\n\n"
        else:
            user_prompt += "请先分析目标中是否存在分钟、小时、天、周、月、年等时间表达；如果没有，请自行判断一个合理的按天学习周期。\n\n"
    else:
        user_prompt = "请根据提供的教材内容生成学习计划。\n\n"

    if file_text:
        max_text_length = 3000
        if len(file_text) > max_text_length:
            # Cap the document excerpt so long uploads do not crowd out the
            # actual planning instructions in the model context window.
            file_text = file_text[:max_text_length] + "\n\n[内容已截断...]"
        user_prompt += f"教材内容摘要：\n{file_text}\n\n"
    elif not goals or not goals.strip():
        raise ValueError("请至少提供学习目标或上传教材文件")

    user_prompt += "请生成详细的学习计划，输出JSON格式。"
    return user_prompt


def generate_study_plan(
    user_id: int,
    goals: str = "",
    file_text: Optional[str] = None,
    provider: Optional[str] = None,
    duration_days: Optional[int] = None,
) -> List[Dict]:
    """
    生成学习计划

    Args:
        user_id: 用户ID
        goals: 用户学习目标
        file_text: 上传文件的文本内容
        provider: AI模型提供商
        duration_days: 可选外部指定天数；默认优先自动识别

    Returns:
        List[Dict]: 学习计划列表，每个元素包含 day, topic, tasks
    """
    user_prompt = build_user_prompt(goals=goals, file_text=file_text, duration_days=duration_days)

    try:
        if provider is None:
            provider = get_provider_config()
        elif provider not in ["deepseek", "wenxin", "xinghuo", "chatglm", "moonshot"]:
            provider = get_provider_config()

        config = get_api_config(provider)
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError(f"错误：未配置 {provider.upper()}_API_KEY，请在 .env 文件中设置")

        client = OpenAI(api_key=api_key, base_url=config.get("base_url"))
        response = client.chat.completions.create(
            model=config.get("model"),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            temperature=0.7,
        )

        response_text = response.choices[0].message.content
        plan_json = clean_and_extract_json(response_text)
        plan_data = json.loads(plan_json)

        if not isinstance(plan_data, list):
            raise ValueError("AI返回的不是数组格式")

        for item in plan_data:
            if not isinstance(item, dict):
                raise ValueError("计划项必须是对象")
            if "day" not in item or "topic" not in item or "tasks" not in item:
                raise ValueError("计划项缺少必要字段：day, topic, tasks")

        return plan_data
    except json.JSONDecodeError as exc:
        preview = response_text[:200] if "response_text" in locals() else "N/A"
        raise ValueError(f"JSON解析失败: {str(exc)}，原始响应: {preview}")
    except Exception as exc:
        raise ValueError(f"生成学习计划失败: {str(exc)}")


def clean_and_extract_json(text: str) -> str:
    """
    清理AI响应，提取JSON内容
    """
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)

    start_idx = text.find("[")
    end_idx = text.rfind("]")
    if start_idx == -1 or end_idx == -1:
        raise ValueError("无法在响应中找到JSON内容")

    return text[start_idx:end_idx + 1].strip()
