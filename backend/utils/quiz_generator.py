"""
AI测评生成器
使用配置的AI模型生成题目和批改讲解
"""
import json
import re
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from services.ai_service import AIService
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
            max_tokens=3000
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
        for item in quiz_data:
            if not isinstance(item, dict):
                raise ValueError("题目项必须是对象")
            if "question" not in item or "answer" not in item or "type" not in item:
                raise ValueError("题目项缺少必要字段：question, answer, type")
            if item["type"] == "choice" and "options" not in item:
                raise ValueError("选择题缺少options字段")
        
        logger.info(f"成功生成{len(quiz_data)}道题目，主题：{topic}")
        return quiz_data
        
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
            max_tokens=2000,
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
        for item in quiz_data:
            if not isinstance(item, dict):
                raise ValueError("题目项必须是对象")
            if "question" not in item or "answer" not in item or "type" not in item:
                raise ValueError("题目项缺少必要字段：question, answer, type")
            if item["type"] == "choice" and "options" not in item:
                raise ValueError("选择题缺少options字段")
        
        return quiz_data
        
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {str(e)}，原始响应: {response_text[:200] if 'response_text' in locals() else 'N/A'}")
    except Exception as e:
        raise ValueError(f"生成测验题目失败: {str(e)}")


def evaluate_quiz(questions: List[Dict], user_answers: List[str], provider: Optional[str] = None) -> Dict:
    """
    批改测验并生成讲解
    
    Args:
        questions: 题目列表
        user_answers: 用户答案列表
        provider: AI模型提供商（可选，默认使用.env配置）
        
    Returns:
        Dict: 包含 score 和 explanations
    """
    # 构建答题数据文本
    qa_text = ""
    for i, q in enumerate(questions):
        user_answer = user_answers[i] if i < len(user_answers) else ""
        qa_text += f"题目{i+1}：{q.get('question', '')}\n"
        qa_text += f"标准答案：{q.get('answer', '')}\n"
        qa_text += f"用户答案：{user_answer}\n"
        if q.get('type') == 'choice' and 'options' in q:
            qa_text += f"选项：{', '.join(q.get('options', []))}\n"
        qa_text += "\n"
    
    user_prompt = f"请根据以下题目与答案进行评分并提供讲解。\n\n{qa_text}"
    
    # 调用AI批改
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
        
        # 调用 AI 模型批改
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": EVALUATION_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=2000,
            temperature=0.3,  # 降低温度，使批改更准确
        )
        
        # 提取返回内容
        response_text = response.choices[0].message.content
        
        # 清理响应内容，提取JSON
        result_json = clean_and_extract_json(response_text, is_object=True)
        
        # 解析JSON
        result_data = json.loads(result_json)
        
        # 验证数据结构
        if not isinstance(result_data, dict):
            raise ValueError("AI返回的不是对象格式")
        if "score" not in result_data or "explanations" not in result_data:
            raise ValueError("返回数据缺少必要字段：score, explanations")
        
        return result_data
        
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {str(e)}，原始响应: {response_text[:200] if 'response_text' in locals() else 'N/A'}")
    except Exception as e:
        raise ValueError(f"批改测验失败: {str(e)}")


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

