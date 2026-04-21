"""
AI测评生成器
使用配置的AI模型生成题目和批改讲解
"""
import json
import re
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from core.config import settings
from core.exceptions import UpstreamServiceError
from services.ai_service import AIService
from services.prompt_service import PromptService
from core.logger import logger
from utils.openai_client import get_provider_config, get_api_config
from openai import OpenAI

# 系统提示词
QUIZ_GENERATION_PROMPT = """你是智学伴，一个AI个性化学习与测评助手，由智学伴项目团队开发。

你的任务是帮助用户生成个性化的测验题目。请根据用户提供的主题，生成高质量的测验题。

要求：
1. 生成5道题目（3道选择题 + 2道填空题）
2. 选择题有4个选项（A、B、C、D）
3. 题目要具体、有针对性
4. 难度适中，适合学习检测
5. 输出格式必须是有效的JSON数组
6. 不要包含任何Markdown格式符号（如```json、```等）
7. 直接输出JSON，不要有其他说明文字

输出格式示例：
[
  {
    "question": "Python中用于定义函数的关键字是什么？",
    "options": ["A. function", "B. def", "C. define", "D. func"],
    "answer": "B",
    "type": "choice"
  },
  {
    "question": "Python中用于输出内容到控制台的函数是____。",
    "answer": "print",
    "type": "fill"
  }
]"""

EVALUATION_PROMPT = """你是智学伴，一个AI个性化学习与测评助手，由智学伴项目团队开发。

你的任务是批改用户的测验答案并提供详细的讲解。

要求：
1. 对每道题进行判断（正确/错误）
2. 计算总分（满分100分，每题20分）
3. 为每道题提供详细的讲解
4. 如果答错，要说明正确答案和原因
5. 输出格式必须是有效的JSON对象
6. 不要包含任何Markdown格式符号
7. 直接输出JSON，不要有其他说明文字

输出格式示例：
{
  "score": 80,
  "explanations": [
    {
      "question": "题目内容",
      "correct": true,
      "explanation": "讲解内容：你的答案是正确的。这是因为..."
    }
  ]
}"""


# AI-assisted: DeepSeek-V3 2025-12 — 试题生成Prompt结构与JSON解析框架
# Prompt: "请为K12教育平台设计一个试题生成Prompt，要求严格JSON数组输出..."
# 修改: 增加clean_and_extract_json()容错解析、题型分布参数、嵌套JSON截断处理由开发者重写
def generate_quiz(
    topic: str,
    num_questions: int = 5,
    question_type_distribution: Optional[Dict[str, int]] = None,
    provider: Optional[str] = None,
    db: Optional[Session] = None
) -> List[Dict]:
    """
    根据主题生成测验题目
    
    Args:
        topic: 测验主题（例如："Python基础语法"）
        num_questions: 题目数量（默认5道）
        question_type_distribution: 题型分布，如 {"choice": 3, "fill": 2}（可选）
        provider: AI模型提供商（可选，默认使用.env配置）
        
    Returns:
        List[Dict]: 题目列表，每个元素包含 question, type, options(选择题), answer
    """
    # 如果没有指定题型分布，使用默认分布
    if question_type_distribution is None:
        # 默认：60%选择题，40%填空题
        choice_count = max(1, int(num_questions * 0.6))
        fill_count = num_questions - choice_count
        question_type_distribution = {
            "choice": choice_count,
            "fill": fill_count
        }
    
    # 验证题型分布总和是否等于总题数
    total_distributed = sum(question_type_distribution.values())
    if total_distributed != num_questions:
        # 自动调整，按比例分配
        if total_distributed > 0:
            ratio = num_questions / total_distributed
            question_type_distribution = {
                k: max(1, int(v * ratio)) if v > 0 else 0
                for k, v in question_type_distribution.items()
            }
            # 确保总和正确
            current_total = sum(question_type_distribution.values())
            if current_total < num_questions:
                # 优先补充选择题
                if "choice" in question_type_distribution:
                    question_type_distribution["choice"] += (num_questions - current_total)
                else:
                    question_type_distribution["fill"] = question_type_distribution.get("fill", 0) + (num_questions - current_total)
        else:
            # 如果分布为空，使用默认
            choice_count = max(1, int(num_questions * 0.6))
            fill_count = num_questions - choice_count
            question_type_distribution = {
                "choice": choice_count,
                "fill": fill_count
            }
    
    # 构建用户提示
    user_prompt = f"请围绕主题「{topic}」生成{num_questions}道测验题。\n\n"
    user_prompt += "题目要求：\n"
    user_prompt += f"- 生成{num_questions}道题目\n"
    
    # 添加题型分布说明
    try:
        from utils.paper_templates import PaperTemplates
        type_names_map = PaperTemplates.TYPE_NAMES
    except ImportError:
        type_names_map = {
            "choice": "选择题",
            "multiple_choice": "多选题",
            "fill": "填空题",
            "judge": "判断题",
            "essay": "简答题",
            "calculation": "计算题",
            "comprehensive": "综合题"
        }
    
    type_distribution_text = []
    for qtype, count in question_type_distribution.items():
        if count > 0:
            type_name = type_names_map.get(qtype, qtype)
            type_distribution_text.append(f"{count}道{type_name}")
    
    if type_distribution_text:
        user_prompt += f"- 题型分布：{', '.join(type_distribution_text)}\n"
    
    # 添加题型特殊要求
    if "multiple_choice" in question_type_distribution and question_type_distribution["multiple_choice"] > 0:
        user_prompt += "- 多选题需要明确标注正确选项（可以是多个）\n"
    if "judge" in question_type_distribution and question_type_distribution["judge"] > 0:
        user_prompt += "- 判断题答案应为'正确'或'错误'\n"
    if "calculation" in question_type_distribution and question_type_distribution["calculation"] > 0:
        user_prompt += "- 计算题需要提供详细的解题步骤\n"
    
    user_prompt += "- 选择题要有4个选项（A、B、C、D）\n"
    user_prompt += "- 题目要具体、有针对性\n"
    user_prompt += "- 难度适中\n"
    user_prompt += "- 每道题尽量补充 knowledge_point（字符串）或 knowledge_points（字符串数组），用于交卷后的知识点诊断\n"
    user_prompt += "- knowledge_point 必须写成知识点、方法、章节或能力点，不要只写题型名称\n"
    user_prompt += "\n请生成题目，输出JSON格式。"
    
    # 调用AI生成题目
    try:
        if db is None:
            # 如果没有传入db，使用旧的openai_client方式（向后兼容）
            logger.warning("generate_quiz未传入db参数，使用旧版openai_client")
            return generate_quiz_legacy(topic, num_questions, question_type_distribution, provider)
        
        # 使用统一的AIService
        result = AIService.call_ai(
            db=db,
            user_prompt=user_prompt,
            system_prompt_name="quiz_generator_prompt",
            provider=provider,
            temperature=0.7,
            max_tokens=settings.AI_DEFAULT_MAX_TOKENS
        )
        
        # 提取返回内容
        response_text = result.get("raw", "") or result.get("text", "")
        
        if not response_text:
            logger.error("AI返回内容为空")
            raise ValueError("AI返回内容为空，请检查AI服务配置")
        
        logger.debug(f"AI返回内容（前500字符）: {response_text[:500]}")
        
        # 清理响应内容，提取JSON
        try:
            quiz_json = clean_and_extract_json(response_text)
            logger.debug(f"提取的JSON（前500字符）: {quiz_json[:500]}")
        except ValueError as e:
            logger.error(f"提取JSON失败: {str(e)}，原始响应: {response_text[:500]}")
            raise ValueError(f"AI返回格式错误，无法提取JSON: {str(e)}")
        
        # 解析JSON
        try:
            quiz_data = json.loads(quiz_json)
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {str(e)}，提取的JSON: {quiz_json[:500]}")
            raise ValueError(f"JSON解析失败: {str(e)}，请检查AI返回格式")
        
        # 验证数据结构
        if not isinstance(quiz_data, list):
            raise ValueError("AI返回的不是数组格式")
        
        # 验证每个题目的结构
        for index, item in enumerate(quiz_data):
            if not isinstance(item, dict):
                raise ValueError("题目项必须是对象")
            if "question" not in item or "answer" not in item or "type" not in item:
                raise ValueError("题目项缺少必要字段：question, answer, type")
            if item["type"] == "choice" and "options" not in item:
                raise ValueError("选择题缺少options字段")
            quiz_data[index] = _normalize_question_metadata(item)
        
        logger.info(f"成功生成{len(quiz_data)}道题目，主题：{topic}")
        return quiz_data
        
    except UpstreamServiceError:
        raise
    except ValueError as e:
        # ValueError 直接抛出，已经包含错误信息
        raise
    except Exception as e:
        logger.error(f"生成测验题目失败: {str(e)}", exc_info=True)
        raise ValueError(f"生成测验题目失败: {str(e)}")


def generate_quiz_legacy(
    topic: str,
    num_questions: int = 5,
    question_type_distribution: Optional[Dict[str, int]] = None,
    provider: Optional[str] = None
) -> List[Dict]:
    """旧版生成函数（向后兼容）"""
    
    # 构建用户提示（简化版）
    user_prompt = f"请围绕主题「{topic}」生成{num_questions}道测验题。\n\n"
    user_prompt += "题目要求：\n"
    user_prompt += f"- 生成{num_questions}道题目\n"
    
    if question_type_distribution:
        type_names = {
            "choice": "选择题",
            "fill": "填空题",
            "judge": "判断题"
        }
        type_distribution_text = []
        for qtype, count in question_type_distribution.items():
            if count > 0:
                type_name = type_names.get(qtype, qtype)
                type_distribution_text.append(f"{count}道{type_name}")
        if type_distribution_text:
            user_prompt += f"- 题型分布：{', '.join(type_distribution_text)}\n"
    
    user_prompt += "- 选择题要有4个选项（A、B、C、D）\n"
    user_prompt += "- 题目要具体、有针对性\n"
    user_prompt += "- 难度适中\n"
    user_prompt += "- 每道题尽量补充 knowledge_point（字符串）或 knowledge_points（字符串数组）\n"
    user_prompt += "- knowledge_point 必须写成知识点、方法、章节或能力点，不要只写题型名称\n"
    user_prompt += "\n请生成题目，输出JSON格式。"
    
    try:
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
        
        # 创建 OpenAI 客户端
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 调用 AI 模型生成题目
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": QUIZ_GENERATION_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            temperature=0.7,
        )
        
        # 提取返回内容
        response_text = response.choices[0].message.content
        
        # 清理响应内容，提取JSON
        quiz_json = clean_and_extract_json(response_text)
        
        # 解析JSON
        quiz_data = json.loads(quiz_json)
        
        # 验证数据结构
        if not isinstance(quiz_data, list):
            raise ValueError("AI返回的不是数组格式")
        
        # 验证每个题目的结构
        for index, item in enumerate(quiz_data):
            if not isinstance(item, dict):
                raise ValueError("题目项必须是对象")
            if "question" not in item or "answer" not in item or "type" not in item:
                raise ValueError("题目项缺少必要字段：question, answer, type")
            if item["type"] == "choice" and "options" not in item:
                raise ValueError("选择题缺少options字段")
            quiz_data[index] = _normalize_question_metadata(item)
        
        return quiz_data
        
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {str(e)}，原始响应: {response_text[:200] if 'response_text' in locals() else 'N/A'}")
    except Exception as e:
        raise ValueError(f"生成测验题目失败: {str(e)}")


def _stringify_quiz_value(value) -> str:
    if value is None:
        return ""

    if isinstance(value, str):
        return value

    if isinstance(value, list):
        return ", ".join(
            item for item in (_stringify_quiz_value(entry).strip() for entry in value) if item
        )

    if isinstance(value, dict):
        for key in ("text", "content", "label", "name", "value", "answer"):
            if value.get(key) not in (None, ""):
                return _stringify_quiz_value(value.get(key))
        try:
            return json.dumps(value, ensure_ascii=False)
        except TypeError:
            return str(value)

    return str(value)


def _stringify_quiz_option(option) -> str:
    if isinstance(option, dict):
        option_value = None
        for key in ("value", "key", "id"):
            if option.get(key) not in (None, ""):
                option_value = _stringify_quiz_value(option.get(key)).strip()
                break

        option_text = None
        for key in ("text", "content", "label", "name"):
            if option.get(key) not in (None, ""):
                option_text = _stringify_quiz_value(option.get(key)).strip()
                break

        if option_value and option_text:
            return f"{option_value}. {option_text}"

        if option_text:
            return option_text

        if option_value:
            return option_value

        if option:
            return ", ".join(
                f"{key}. {_stringify_quiz_value(value)}" for key, value in option.items()
            )

        return ""

    return _stringify_quiz_value(option)


def _stringify_quiz_options(options) -> List[str]:
    if isinstance(options, dict):
        return [
            f"{key}. {_stringify_quiz_value(value)}"
            for key, value in options.items()
            if _stringify_quiz_value(value).strip()
        ]

    if isinstance(options, list):
        return [item for item in (_stringify_quiz_option(option).strip() for option in options) if item]

    single_option = _stringify_quiz_option(options).strip()
    return [single_option] if single_option else []


def _normalize_knowledge_points(raw_value) -> List[str]:
    if raw_value in (None, ""):
        return []

    if isinstance(raw_value, str):
        text = raw_value.strip()
        if not text:
            return []

        if text.startswith("[") or text.startswith("{"):
            try:
                return _normalize_knowledge_points(json.loads(text))
            except (TypeError, ValueError, json.JSONDecodeError):
                pass

        return [
            item.strip()
            for item in re.split(r"[,，、；;/\n]+", text)
            if item and item.strip()
        ]

    if isinstance(raw_value, list):
        normalized_points: List[str] = []
        for item in raw_value:
            normalized_points.extend(_normalize_knowledge_points(item))
        return list(dict.fromkeys(normalized_points))

    if isinstance(raw_value, dict):
        for key in ("knowledge_points", "knowledge_point", "points", "point", "name", "label", "text"):
            if key in raw_value and raw_value.get(key) not in (None, ""):
                return _normalize_knowledge_points(raw_value.get(key))
        return []

    value = str(raw_value).strip()
    return [value] if value else []


def _normalize_question_metadata(question: Dict) -> Dict:
    knowledge_points = _normalize_knowledge_points(
        question.get("knowledge_points", question.get("knowledge_point"))
    )
    normalized_question = dict(question)
    if knowledge_points:
        normalized_question["knowledge_points"] = knowledge_points
        normalized_question["knowledge_point"] = normalized_question.get("knowledge_point") or knowledge_points[0]
    return normalized_question


def _resolve_evaluation_prompt_name(db: Optional[Session]) -> str:
    if db is not None:
        for prompt_name in ("answer_evaluation_prompt", "quiz_evaluation_prompt"):
            if PromptService.get_system_prompt(db, prompt_name):
                return prompt_name
    return "answer_evaluation_prompt"


def _normalize_explanations(explanations, questions: List[Dict], user_answers: List[str]) -> List[Dict]:
    normalized_explanations: List[Dict] = []

    for index, item in enumerate(explanations or []):
        explanation = item if isinstance(item, dict) else {"explanation": _stringify_quiz_value(item)}
        question = questions[index] if index < len(questions) else {}
        is_correct = explanation.get("is_correct")
        if is_correct is None:
            is_correct = explanation.get("correct")
        is_correct = bool(is_correct)

        correct_answer = explanation.get("correct_answer", question.get("answer"))
        user_answer = explanation.get("user_answer")
        if user_answer in (None, ""):
            user_answer = user_answers[index] if index < len(user_answers) else ""

        normalized_explanations.append(
            {
                **explanation,
                "question": explanation.get("question") or _stringify_quiz_value(question.get("question", "")),
                "user_answer": _stringify_quiz_value(user_answer),
                "correct_answer": _stringify_quiz_value(correct_answer),
                "correct": is_correct,
                "is_correct": is_correct,
                "explanation": _stringify_quiz_value(explanation.get("explanation", "")),
            }
        )

    return normalized_explanations


def _fallback_weak_points(questions: List[Dict], explanations: List[Dict]) -> List[Dict]:
    grouped: Dict[str, Dict] = {}

    for index, explanation in enumerate(explanations):
        if explanation.get("correct"):
            continue

        question = questions[index] if index < len(questions) else {}
        knowledge_points = _normalize_knowledge_points(
            explanation.get("knowledge_points")
            or explanation.get("knowledge_point")
            or question.get("knowledge_points")
            or question.get("knowledge_point")
        )
        if not knowledge_points:
            continue

        for knowledge_point in knowledge_points:
            entry = grouped.setdefault(
                knowledge_point,
                {
                    "knowledge_point": knowledge_point,
                    "reason": "该知识点相关题目出现失分，建议结合逐题解析重新复盘核心概念、方法与易错点。",
                    "related_questions": [],
                    "_count": 0,
                },
            )
            entry["_count"] += 1
            entry["related_questions"].append(index + 1)

    if not grouped:
        return []

    ordered_entries = sorted(grouped.values(), key=lambda item: item["_count"], reverse=True)[:3]
    for item in ordered_entries:
        item["related_questions"] = sorted(set(item["related_questions"]))
        item.pop("_count", None)
    return ordered_entries


def _normalize_weak_points(raw_weak_points, questions: List[Dict], explanations: List[Dict]) -> List[Dict]:
    weak_points: List[Dict] = []

    if isinstance(raw_weak_points, list):
        for item in raw_weak_points:
            if isinstance(item, dict):
                knowledge_point = _stringify_quiz_value(
                    item.get("knowledge_point")
                    or item.get("name")
                    or item.get("point")
                    or item.get("knowledge")
                ).strip()
                if not knowledge_point:
                    knowledge_candidates = _normalize_knowledge_points(item.get("knowledge_points"))
                    knowledge_point = knowledge_candidates[0] if knowledge_candidates else ""
                if not knowledge_point:
                    continue

                related_questions = item.get("related_questions", item.get("question_numbers", item.get("questions", [])))
                if not isinstance(related_questions, list):
                    related_questions = [related_questions] if related_questions not in (None, "") else []

                normalized_related_questions: List[int] = []
                for question_no in related_questions:
                    try:
                        normalized_related_questions.append(int(question_no))
                    except (TypeError, ValueError):
                        continue

                weak_points.append(
                    {
                        "knowledge_point": knowledge_point,
                        "reason": _stringify_quiz_value(item.get("reason") or item.get("analysis") or item.get("description")),
                        "related_questions": sorted(set(normalized_related_questions)),
                    }
                )
            else:
                knowledge_point = _stringify_quiz_value(item).strip()
                if knowledge_point:
                    weak_points.append(
                        {
                            "knowledge_point": knowledge_point,
                            "reason": "",
                            "related_questions": [],
                        }
                    )

    if weak_points:
        return weak_points[:3]

    return _fallback_weak_points(questions, explanations)


def _normalize_next_steps(raw_next_steps, weak_points: List[Dict], raw_suggestions=None) -> List[str]:
    steps: List[str] = []

    def _extend_from_value(value):
        if value in (None, ""):
            return
        if isinstance(value, list):
            for item in value:
                _extend_from_value(item)
            return

        text = _stringify_quiz_value(value).strip()
        if not text:
            return

        segments = [
            segment.strip(" -0123456789.、)")
            for segment in re.split(r"[\n\r]+|(?<=[。！？；;])", text)
            if segment and segment.strip(" -0123456789.、)")
        ]

        if segments:
            steps.extend(segments)
        else:
            steps.append(text)

    _extend_from_value(raw_next_steps)
    if not steps:
        _extend_from_value(raw_suggestions)

    deduplicated_steps = list(dict.fromkeys(step for step in steps if step))
    if deduplicated_steps:
        return deduplicated_steps[:4]

    if weak_points:
        generated_steps = [
            f"优先复习“{item['knowledge_point']}”相关概念、方法和典型题，重新完成关联错题。"
            for item in weak_points[:3]
        ]
        if generated_steps:
            generated_steps.append("整理本次错题的共同失分原因，形成一份可复用的复习清单。")
        return generated_steps[:4]

    return ["继续保持当前节奏，下一轮测评可适当提高难度并关注答题稳定性。"]


def normalize_evaluation_result(result_data: Dict, questions: List[Dict], user_answers: List[str]) -> Dict:
    normalized_questions = [_normalize_question_metadata(question) for question in questions]
    normalized_explanations = _normalize_explanations(result_data.get("explanations", []), normalized_questions, user_answers)
    correct_count = sum(1 for item in normalized_explanations if item.get("correct"))
    raw_total_count = result_data.get("total_count")
    try:
        total_count = int(raw_total_count) if raw_total_count is not None else 0
    except (TypeError, ValueError):
        total_count = 0
    if total_count <= 0:
        total_count = len(normalized_explanations) or len(normalized_questions) or 0

    weak_points = _normalize_weak_points(
        result_data.get("weak_points"),
        normalized_questions,
        normalized_explanations,
    )
    next_steps = _normalize_next_steps(
        result_data.get("next_steps"),
        weak_points,
        raw_suggestions=result_data.get("suggestions"),
    )
    summary = _stringify_quiz_value(
        result_data.get("summary")
        or result_data.get("suggestions")
    ).strip()

    if not summary:
        if weak_points:
            summary = f"本次失分主要集中在{ '、'.join(item['knowledge_point'] for item in weak_points[:3]) }，建议先围绕这些知识点做针对性复盘。"
        elif total_count > 0:
            summary = "本次作答整体较稳定，可以在保持正确率的同时继续提升难度或压缩用时。"
        else:
            summary = "本次测评已完成，建议结合逐题解析继续巩固关键知识点。"

    raw_score = result_data.get("score", 0)
    try:
        normalized_score = max(0, min(100, int(round(float(raw_score)))))
    except (TypeError, ValueError):
        normalized_score = int(round((correct_count / total_count) * 100)) if total_count else 0

    total_score = result_data.get("total_score")
    try:
        normalized_total_score = int(total_score)
    except (TypeError, ValueError):
        normalized_total_score = 100

    raw_correct_count = result_data.get("correct_count")
    try:
        normalized_correct_count = int(raw_correct_count) if raw_correct_count is not None else correct_count
    except (TypeError, ValueError):
        normalized_correct_count = correct_count

    return {
        **result_data,
        "score": normalized_score,
        "total_score": normalized_total_score,
        "correct_count": normalized_correct_count,
        "total_count": total_count,
        "summary": summary,
        "weak_points": weak_points,
        "next_steps": next_steps,
        "explanations": normalized_explanations,
    }


def evaluate_quiz(
    questions: List[Dict],
    user_answers: List[str],
    provider: Optional[str] = None,
    db: Optional[Session] = None
) -> Dict:
    """
    批改测验并生成讲解

    Args:
        questions: 题目列表
        user_answers: 用户答案列表
        provider: AI模型提供商（可选，默认使用数据库配置）
        db: 数据库会话（推荐传入，使用数据库中的 API key）

    Returns:
        Dict: 包含 score 和 explanations
    """
    # 构建答题数据文本，兼容字符串、对象化选项和历史缓存结构
    qa_text = ""
    review_items = []
    normalized_questions = [_normalize_question_metadata(question) for question in questions]

    for i, q in enumerate(normalized_questions):
        user_answer = _stringify_quiz_value(user_answers[i] if i < len(user_answers) else "")
        standard_answer = _stringify_quiz_value(q.get("answer", ""))
        option_texts = _stringify_quiz_options(q.get("options", [])) if "options" in q else []
        knowledge_points = _normalize_knowledge_points(q.get("knowledge_points", q.get("knowledge_point")))

        qa_text += f"题目{i+1}：{_stringify_quiz_value(q.get('question', ''))}\n"
        qa_text += f"题型：{_stringify_quiz_value(q.get('type', ''))}\n"
        qa_text += f"标准答案：{standard_answer}\n"
        qa_text += f"用户答案：{user_answer}\n"
        if option_texts:
            qa_text += f"选项：{', '.join(option_texts)}\n"
        if knowledge_points:
            qa_text += f"题目知识点：{', '.join(knowledge_points)}\n"
        qa_text += "\n"

        review_items.append(
            {
                "question_no": i + 1,
                "question": _stringify_quiz_value(q.get("question", "")),
                "type": _stringify_quiz_value(q.get("type", "")),
                "options": option_texts,
                "correct_answer": standard_answer,
                "user_answer": user_answer,
                "knowledge_point": knowledge_points[0] if knowledge_points else "",
                "knowledge_points": knowledge_points,
            }
        )

    user_prompt = (
        "请根据以下题目与答案进行评分并提供讲解。\n"
        "除了逐题解析外，请额外完成知识点级复盘：\n"
        "1. weak_points 必须总结为知识点、方法、章节或能力点，不要写成“单选题/填空题/判断题”等题型名称。\n"
        "2. next_steps 必须给出 2-4 条围绕薄弱知识点的学习建议。\n"
        "3. summary 需要概括当前表现与复习重点。\n"
        "4. 如果题目自带 knowledge_point 或 knowledge_points，请优先据此总结薄弱点。\n\n"
        f"题目与作答信息：\n{qa_text}\n"
        f"结构化作答数据：\n{json.dumps(review_items, ensure_ascii=False, indent=2)}"
    )

    # 调用AI批改
    try:
        if db is None:
            logger.warning("evaluate_quiz未传入db参数，使用旧版openai_client")
            return _evaluate_quiz_legacy(questions, user_answers, provider, user_prompt)

        # 使用统一的AIService（从数据库读取 API key）
        prompt_name = _resolve_evaluation_prompt_name(db)
        result = AIService.call_ai(
            db=db,
            user_prompt=user_prompt,
            system_prompt_name=prompt_name,
            provider=provider,
            temperature=0.3,
            max_tokens=settings.AI_DEFAULT_MAX_TOKENS
        )

        response_text = result.get("raw", "") or result.get("text", "")

        if not response_text:
            logger.error("AI返回内容为空")
            raise ValueError("AI返回内容为空，请检查AI服务配置")

        logger.debug(f"AI批改返回（前500字符）: {response_text[:500]}")

        try:
            result_json = clean_and_extract_json(response_text, is_object=True)
        except ValueError as e:
            logger.error(f"提取JSON失败: {str(e)}，原始响应: {response_text[:500]}")
            raise ValueError(f"AI返回格式错误，无法提取JSON: {str(e)}")

        try:
            result_data = json.loads(result_json)
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {str(e)}，提取的JSON: {result_json[:500]}")
            raise ValueError(f"JSON解析失败: {str(e)}")

        if not isinstance(result_data, dict):
            raise ValueError("AI返回的不是对象格式")
        if "score" not in result_data or "explanations" not in result_data:
            raise ValueError("返回数据缺少必要字段：score, explanations")

        normalized_result = normalize_evaluation_result(result_data, normalized_questions, user_answers)
        logger.info(f"测验批改完成，得分：{normalized_result.get('score')}")
        return normalized_result

    except UpstreamServiceError:
        raise
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"批改测验失败: {str(e)}", exc_info=True)
        raise ValueError(f"批改测验失败: {str(e)}")


def _evaluate_quiz_legacy(
    questions: List[Dict],
    user_answers: List[str],
    provider: Optional[str],
    user_prompt: str
) -> Dict:
    """旧版批改函数（向后兼容，无db时使用环境变量读取API key）"""
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

    client = OpenAI(api_key=api_key, base_url=base_url)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": EVALUATION_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
        temperature=0.3,
    )

    response_text = response.choices[0].message.content
    result_json = clean_and_extract_json(response_text, is_object=True)
    result_data = json.loads(result_json)

    if not isinstance(result_data, dict):
        raise ValueError("AI返回的不是对象格式")
    if "score" not in result_data or "explanations" not in result_data:
        raise ValueError("返回数据缺少必要字段：score, explanations")

    return normalize_evaluation_result(result_data, questions, user_answers)


def clean_and_extract_json(text: str, is_object: bool = False) -> str:
    """
    清理AI响应，提取JSON内容
    
    Args:
        text: AI原始响应
        is_object: 是否为JSON对象（True）还是数组（False）
        
    Returns:
        str: 清理后的JSON字符串
    """
    if not text or not text.strip():
        raise ValueError("响应内容为空")
    
    # 移除Markdown代码块标记
    text = re.sub(r'```json\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```\s*', '', text)
    
    if is_object:
        # 查找JSON对象的开始和结束
        start_idx = text.find('{')
        end_idx = text.rfind('}')
    else:
        # 查找JSON数组的开始和结束
        start_idx = text.find('[')
        end_idx = text.rfind(']')
    
    if start_idx == -1 or end_idx == -1:
        # 尝试查找嵌套的JSON（可能在文本中）
        logger.warning(f"未找到JSON边界，尝试其他方法。文本前200字符: {text[:200]}")
        # 尝试直接解析整个文本
        try:
            json.loads(text.strip())
            return text.strip()
        except:
            pass
        raise ValueError(f"无法在响应中找到JSON内容。响应前500字符: {text[:500]}")
    
    json_str = text[start_idx:end_idx + 1]
    
    # 清理多余的空白字符
    json_str = json_str.strip()
    
    # 验证是否是有效的JSON
    try:
        json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"提取的内容不是有效的JSON: {str(e)}，内容: {json_str[:200]}")
    
    return json_str

