"""
试卷组卷服务
作者：智学伴开发团队
目的：实现智能组卷功能
"""
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from services.ai_service import AIService
from repositories.quiz_paper_repo import QuizPaperRepository
from repositories.paper_template_repo import PaperTemplateRepository
from utils.paper_templates import PaperTemplates
from core.logger import logger


class QuizPaperService:
    """试卷组卷服务类"""
    
    @staticmethod
    def generate_custom_paper(
        db: Session,
        user_id: int,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        生成自定义试卷
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            config: 组卷配置
                - title: 试卷标题
                - subject: 科目
                - grade_level: 学段
                - total_questions: 总题数
                - difficulty_distribution: 难度分布 {easy: 30, medium: 50, hard: 20}
                - question_type_distribution: 题型分布 {choice: 10, fill: 5, essay: 5}
                - knowledge_points: 知识点列表
                - time_limit: 考试时长（分钟）
                - use_template: 是否使用模板（如果为True，会根据学段和科目自动填充默认配置）
        
        Returns:
            Dict: 包含试卷ID和题目列表
        """
        try:
            # 如果使用模板，自动填充默认配置
            if config.get("use_template", False):
                template = PaperTemplates.get_template(
                    config.get("grade_level", "高中"),
                    config.get("subject")
                )
                # 合并模板配置，用户配置优先
                for key in ["total_questions", "question_type_distribution", 
                           "difficulty_distribution", "time_limit", "total_score"]:
                    if key not in config or config[key] is None:
                        config[key] = template.get(key)
            total_questions = config.get("total_questions", 20)
            
            # 如果题目数量超过15道，使用分批生成策略（避免JSON截断）
            if total_questions > 15:
                logger.info(f"题目数量较多（{total_questions}道），使用分批生成策略避免JSON截断")
                questions = QuizPaperService._generate_questions_in_batches(
                    db, config, batch_size=15
                )
            else:
                # 题目数量较少，一次性生成
                logger.info(f"题目数量较少（{total_questions}道），使用单批次生成")
                questions = QuizPaperService._generate_questions_single_batch(db, config)
            
            # 验证题目数量
            if len(questions) == 0:
                raise ValueError("未能生成任何题目，请检查配置或稍后重试")
            
            if len(questions) < total_questions:
                logger.warning(f"生成的题目数量不足：期望{total_questions}，实际{len(questions)}")
                # 不抛出错误，继续使用已生成的题目
            
            # 生成标准答案
            answer_key = QuizPaperService._generate_answer_key(questions)
            
            logger.info(f"最终生成{len(questions)}道题目，准备保存到数据库")
            
            # 保存试卷到数据库
            paper = QuizPaperRepository.create(
                db=db,
                user_id=user_id,
                title=config.get("title", "自定义试卷"),
                subject=config.get("subject"),
                grade_level=config.get("grade_level"),
                total_questions=len(questions),
                difficulty_distribution=config.get("difficulty_distribution"),
                question_type_distribution=config.get("question_type_distribution"),
                knowledge_points=config.get("knowledge_points"),
                questions=questions,
                answer_key=answer_key,
                paper_type="custom",
                time_limit=config.get("time_limit"),
                total_score=config.get("total_score", 100)
            )
            
            return {
                "success": True,
                "paper_id": paper.id,
                "title": paper.title,
                "questions": questions,
                "answer_key": answer_key,
                "total_questions": len(questions),
                "total_score": paper.total_score
            }
            
        except Exception as e:
            logger.error(f"生成自定义试卷失败: {e}", exc_info=True)
            raise ValueError(f"生成试卷失败: {str(e)}")
    
    @staticmethod
    def _generate_questions_single_batch(
        db: Session,
        config: Dict[str, Any]
    ) -> List[Dict]:
        """单批次生成题目（适用于题目数量较少的情况）"""
        prompt = QuizPaperService._build_paper_generation_prompt(config)
        total_questions = config.get("total_questions", 20)
        
        # 计算tokens
        estimated_tokens = max(6000, total_questions * 350 + 3000)
        max_tokens = min(estimated_tokens, 16000)
        
        questions = []
        max_retries = 2
        
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"单批次生成：第{attempt + 1}次尝试（期望{total_questions}道题，max_tokens={max_tokens}）")
                
                result = AIService.call_ai(
                    db=db,
                    user_prompt=prompt,
                    system_prompt_name="quiz_generator_prompt",
                    temperature=0.7,
                    max_tokens=max_tokens
                )
                
                raw_text = result.get("raw", "") or result.get("text", "")
                
                if not raw_text:
                    raise ValueError("AI返回内容为空")
                
                logger.info(f"AI返回内容长度: {len(raw_text)}字符")
                if attempt == 0:
                    logger.debug(f"AI返回内容（前800字符）: {raw_text[:800]}")
                    logger.debug(f"AI返回内容（后200字符）: {raw_text[-200:]}")
                
                questions = QuizPaperService._parse_questions_from_text(raw_text)
                
                if questions:
                    logger.info(f"单批次生成成功：解析到{len(questions)}道题目")
                    break
                else:
                    logger.warning(f"第{attempt + 1}次尝试：解析结果为空")
                    if attempt < max_retries:
                        prompt += "\n\n⚠️ 重要提示：请确保输出完整的、格式正确的JSON。所有字符串字段必须用双引号完整闭合。"
                        max_tokens = min(max_tokens + 2000, 16000)
                        continue
                    else:
                        raise ValueError("无法从AI返回中解析出题目")
                        
            except Exception as e:
                logger.error(f"第{attempt + 1}次尝试失败: {e}", exc_info=True)
                if attempt < max_retries:
                    prompt += "\n\n⚠️ 重要提示：请确保输出完整的、格式正确的JSON。所有字符串字段必须用双引号完整闭合。"
                    max_tokens = min(max_tokens + 2000, 16000)
                    continue
                else:
                    raise ValueError(f"生成题目失败（已重试{max_retries}次）: {str(e)}")
        
        return questions
    
    @staticmethod
    def _generate_questions_in_batches(
        db: Session,
        config: Dict[str, Any],
        batch_size: int = 15
    ) -> List[Dict]:
        """分批生成题目（适用于题目数量较多的情况，避免JSON截断）"""
        total_questions = config.get("total_questions", 20)
        question_type_distribution = config.get("question_type_distribution", {})
        
        # 计算需要多少批次
        num_batches = (total_questions + batch_size - 1) // batch_size
        logger.info(f"分批生成：总共{total_questions}道题，分{num_batches}批，每批最多{batch_size}道")
        
        all_questions = []
        remaining_distribution = question_type_distribution.copy()
        remaining_count = total_questions
        
        for batch_num in range(num_batches):
            # 计算本批次需要生成的题目数量
            batch_questions_count = min(batch_size, remaining_count)
            
            # 按比例分配题型（特殊处理作文题）
            batch_distribution = {}
            composition_count = 0
            
            # 先处理作文题：如果有作文题且是最后一批，将作文题分配到这一批
            if "composition" in remaining_distribution:
                composition_count = remaining_distribution.get("composition", 0)
                if composition_count > 0 and batch_num == num_batches - 1:
                    # 最后一批，确保包含作文题
                    batch_distribution["composition"] = composition_count
                    remaining_distribution["composition"] = 0
                    batch_questions_count -= composition_count
                    remaining_count -= composition_count
            
            # 然后按比例分配其他题型
            if remaining_distribution and remaining_count > 0:
                for qtype, total_count in remaining_distribution.items():
                    if total_count > 0 and qtype != "composition":  # 作文题已单独处理
                        # 按剩余比例分配
                        batch_count = max(1, int(total_count * (batch_questions_count / remaining_count))) if remaining_count > 0 else 0
                        batch_distribution[qtype] = min(batch_count, total_count)
                        remaining_distribution[qtype] = total_count - batch_distribution.get(qtype, 0)
            
            # 如果分配后总和不对，调整（但不要调整作文题）
            batch_sum = sum(batch_distribution.values())
            expected_total = batch_questions_count + composition_count
            if batch_sum != expected_total:
                # 调整最大的非作文题型
                if batch_distribution:
                    non_composition_types = {k: v for k, v in batch_distribution.items() if k != "composition"}
                    if non_composition_types:
                        max_type = max(non_composition_types.items(), key=lambda x: x[1])[0]
                        diff = expected_total - batch_sum
                        batch_distribution[max_type] = batch_distribution.get(max_type, 0) + diff
            
            # 更新批次总题数（包含作文题）
            final_batch_count = sum(batch_distribution.values())
            
            # 构建批次配置
            batch_config = config.copy()
            batch_config["total_questions"] = final_batch_count  # 使用包含作文题的总数
            batch_config["question_type_distribution"] = batch_distribution
            
            # 生成批次提示词
            batch_prompt = QuizPaperService._build_paper_generation_prompt(batch_config)
            batch_prompt += f"\n\n重要提示：这是第{batch_num + 1}批（共{num_batches}批），请生成{batch_questions_count}道题目。\n"
            batch_prompt += "请严格按照JSON格式返回，确保：\n"
            batch_prompt += "1. 最外层是对象，包含'questions'字段\n"
            batch_prompt += "2. 'questions'是数组，包含{batch_questions_count}个题目对象\n"
            batch_prompt += "3. 每个题目对象必须包含：question, type, answer, difficulty, knowledge_point\n"
            batch_prompt += "4. 只返回JSON，不要有任何其他文字说明\n"
            batch_prompt += "5. 确保JSON格式完整，不要截断\n"
            
            # 生成本批次题目
            try:
                estimated_tokens = max(8000, batch_questions_count * 400 + 4000)  # 增加token预算
                max_tokens = min(estimated_tokens, 16000)
                
                logger.info(f"生成第{batch_num + 1}/{num_batches}批：{batch_questions_count}道题，max_tokens={max_tokens}")
                
                result = AIService.call_ai(
                    db=db,
                    user_prompt=batch_prompt,
                    system_prompt_name="quiz_generator_prompt",
                    temperature=0.7,
                    max_tokens=max_tokens
                )
                
                raw_text = result.get("raw", "") or result.get("text", "")
                
                if not raw_text:
                    logger.warning(f"第{batch_num + 1}批：AI返回内容为空")
                    continue
                
                # 记录原始响应（用于调试）
                logger.debug(f"第{batch_num + 1}批AI原始响应前500字符: {raw_text[:500]}")
                
                batch_questions = QuizPaperService._parse_questions_from_text(raw_text)
                
                if batch_questions:
                    all_questions.extend(batch_questions)
                    remaining_count -= len(batch_questions)
                    logger.info(f"第{batch_num + 1}批成功：生成{len(batch_questions)}道题目，累计{len(all_questions)}道")
                else:
                    logger.warning(f"第{batch_num + 1}批：解析结果为空，原始响应长度: {len(raw_text)}")
                    # 如果解析失败，记录更多信息用于调试
                    logger.debug(f"第{batch_num + 1}批原始响应完整内容: {raw_text}")
                    
            except Exception as e:
                logger.error(f"第{batch_num + 1}批生成失败: {e}", exc_info=True)
                # 继续生成下一批，不中断整个流程
        
        logger.info(f"分批生成完成：总共生成{len(all_questions)}道题目（期望{total_questions}道）")
        return all_questions
    
    @staticmethod
    def _build_paper_generation_prompt(config: Dict[str, Any]) -> str:
        """构建试卷生成提示词"""
        prompt = f"请根据以下配置生成一份完整的试卷：\n\n"
        prompt += f"**试卷标题**：{config.get('title', '自定义试卷')}\n"
        prompt += f"**科目**：{config.get('subject', '通用')}\n"
        prompt += f"**学段**：{config.get('grade_level', '通用')}\n"
        prompt += f"**总题数**：{config.get('total_questions', 20)}道\n"
        
        # 难度分布
        difficulty = config.get("difficulty_distribution", {})
        if difficulty:
            prompt += f"**难度分布**：\n"
            prompt += f"  - 简单题：{difficulty.get('easy', 0)}%\n"
            prompt += f"  - 中等题：{difficulty.get('medium', 0)}%\n"
            prompt += f"  - 困难题：{difficulty.get('hard', 0)}%\n"
        
        # 题型分布
        question_types = config.get("question_type_distribution", {})
        if question_types:
            prompt += f"**题型分布**：\n"
            for qtype, count in question_types.items():
                if count > 0:
                    type_name = PaperTemplates.get_type_name(qtype)
                    prompt += f"  - {type_name}：{count}道\n"
                    # 如果是作文题，特别说明
                    if qtype == "composition":
                        prompt += f"    （作文题要求：提供完整的作文题目，包括题目要求、字数要求、文体要求等，answer字段可以为空或提供写作指导）\n"
        
        # 知识点
        knowledge_points = config.get("knowledge_points", [])
        if knowledge_points:
            prompt += f"**知识点覆盖**：{', '.join(knowledge_points)}\n"
        
        prompt += "\n**输出要求（非常重要）**：\n"
        prompt += "1. 必须输出完整的、有效的JSON对象，使用```json代码块包裹\n"
        prompt += "2. JSON结构：{\"questions\": [...]}\n"
        prompt += "3. 每道题目必须包含以下字段（不能缺失）：\n"
        prompt += "   - question: 题目内容（字符串，必须用双引号包裹）\n"
        prompt += "   - type: 题型（choice/multiple_choice/fill/judge/essay/calculation/comprehensive/composition，必须用双引号包裹）\n"
        prompt += "   - options: 选项数组（仅选择题需要，格式：[\"A. 选项1\", \"B. 选项2\", ...]，作文题不需要options字段）\n"
        prompt += "   - answer: 答案（字符串，选择题为选项字母如\"A\"，判断题为\"正确\"或\"错误\"，作文题的answer可以为空或提供写作指导）\n"
        prompt += "   - difficulty: 难度（必须是\"easy\"、\"medium\"或\"hard\"之一，完整拼写，不能缩写）\n"
        prompt += "   - knowledge_point: 知识点（字符串，可选）\n"
        prompt += "   注意：如果题型分布中包含作文题（composition），必须生成对应数量的作文题，作文题的question字段应包含完整的作文题目和要求（如字数、文体等）\n"
        prompt += "4. JSON格式要求：\n"
        prompt += "   - 所有字符串必须用双引号包裹，不能使用单引号\n"
        prompt += "   - 所有字段之间必须用逗号分隔\n"
        prompt += "   - 所有字符串必须完整闭合，不能有未闭合的引号\n"
        prompt += "   - 数组和对象必须正确闭合\n"
        prompt += "5. 题目要简洁明了，不要过于冗长\n"
        prompt += "6. 必须生成完整的JSON，确保所有题目都包含在内\n"
        prompt += "7. 输出前请仔细检查JSON格式，确保可以被JSON.parse()成功解析\n"
        prompt += "8. 直接输出JSON代码块，不要有其他说明文字\n"
        
        return prompt
    
    @staticmethod
    def _parse_questions_from_text(text: str) -> List[Dict]:
        """
        从文本中解析题目，支持多种格式和容错处理
        彻底重写，兼容所有可能的格式
        """
        import re
        import json
        if not text or not text.strip():
            logger.warning("输入文本为空")
            return []
        
        # 清理文本 - 更彻底的清理
        text = text.strip()
        
        # 移除Markdown代码块标记（更全面的匹配）
        text = re.sub(r'```json\s*', '', text, flags=re.IGNORECASE | re.MULTILINE)
        text = re.sub(r'```\s*', '', text, flags=re.MULTILINE)
        
        # 移除可能的BOM标记
        if text.startswith('\ufeff'):
            text = text[1:]
        
        # 移除JSON前后的非JSON内容（如说明文字）
        # 尝试找到第一个 { 或 [
        first_brace = text.find('{')
        first_bracket = text.find('[')
        if first_brace != -1 or first_bracket != -1:
            start_idx = min(
                first_brace if first_brace != -1 else len(text),
                first_bracket if first_bracket != -1 else len(text)
            )
            if start_idx > 0:
                text = text[start_idx:]
        
        # 尝试找到最后一个 } 或 ]
        last_brace = text.rfind('}')
        last_bracket = text.rfind(']')
        if last_brace != -1 or last_bracket != -1:
            end_idx = max(
                last_brace if last_brace != -1 else -1,
                last_bracket if last_bracket != -1 else -1
            )
            if end_idx != -1 and end_idx < len(text) - 1:
                text = text[:end_idx + 1]
        
        text = text.strip()
        
        # 方法0: 直接尝试解析整个文本为JSON（最简单的情况）
        try:
            # 先尝试直接解析
            data = json.loads(text)
            if isinstance(data, dict) and "questions" in data:
                questions = data.get("questions", [])
                if questions and isinstance(questions, list) and len(questions) > 0:
                    # 检查是否是字符串数组
                    if isinstance(questions[0], str):
                        parsed = []
                        for q_str in questions:
                            try:
                                q_str_clean = q_str.strip()
                                # 移除可能的转义字符
                                if q_str_clean.startswith('"') and q_str_clean.endswith('"'):
                                    q_str_clean = q_str_clean[1:-1]
                                q_obj = json.loads(q_str_clean)
                                if isinstance(q_obj, dict) and "question" in q_obj:
                                    parsed.append(q_obj)
                            except Exception as e:
                                logger.debug(f"解析字符串数组中的单个题目失败: {e}")
                                continue
                        if parsed:
                            logger.info(f"方法0（直接解析+字符串数组）成功：解析到{len(parsed)}道题目")
                            return parsed
                    elif isinstance(questions[0], dict):
                        # 验证所有题目都有必需字段
                        valid_questions = []
                        for q in questions:
                            if isinstance(q, dict) and "question" in q and "answer" in q:
                                valid_questions.append(q)
                        if valid_questions:
                            logger.info(f"方法0（直接解析）成功：解析到{len(valid_questions)}道题目")
                            return valid_questions
        except json.JSONDecodeError as e:
            logger.debug(f"方法0（直接解析）失败: {e}")
        except Exception as e:
            logger.debug(f"方法0（直接解析）异常: {e}")
        
        # 方法1: 提取questions数组内容，直接解析对象数组（忽略外层引号）
        try:
            # 找到 "questions": [ 的位置
            questions_start = text.find('"questions"')
            if questions_start != -1:
                bracket_start = text.find('[', questions_start)
                if bracket_start != -1:
                    # 找到匹配的 ]
                    bracket_count = 0
                    in_string = False
                    escape_next = False
                    bracket_end = -1
                    
                    for i in range(bracket_start, len(text)):
                        char = text[i]
                        if escape_next:
                            escape_next = False
                            continue
                        if char == '\\':
                            escape_next = True
                            continue
                        if char == '"' and not escape_next:
                            in_string = not in_string
                            continue
                        if not in_string:
                            if char == '[':
                                bracket_count += 1
                            elif char == ']':
                                bracket_count -= 1
                                if bracket_count == 0:
                                    bracket_end = i
                                    break
                    
                    if bracket_end != -1:
                        array_content = text[bracket_start + 1:bracket_end].strip()
                        
                        # 如果数组内容以引号开始，说明是字符串数组格式
                        if array_content.startswith('"'):
                            # 提取字符串内容（去掉外层引号）
                            # 找到第一个 " 和最后一个 "
                            first_quote = array_content.find('"')
                            last_quote = array_content.rfind('"')
                            if first_quote != -1 and last_quote != -1 and last_quote > first_quote:
                                string_content = array_content[first_quote + 1:last_quote]
                                # 处理转义字符
                                string_content = string_content.replace('\\"', '"').replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                                # 现在string_content应该包含多个JSON对象，尝试提取
                                questions = QuizPaperService._extract_objects_from_text(string_content)
                                if questions:
                                    logger.info(f"方法1（字符串数组提取）成功：解析到{len(questions)}道题目")
                                    return questions
                        else:
                            # 直接解析为对象数组
                            questions = QuizPaperService._extract_question_objects(array_content)
                            if questions:
                                logger.info(f"方法1（对象数组提取）成功：解析到{len(questions)}道题目")
                                return questions
        except Exception as e:
            logger.debug(f"方法1失败: {e}")
        
        # 方法2: 使用平衡括号算法提取完整JSON对象
        try:
            start_idx = text.find('{')
            if start_idx != -1:
                brace_count = 0
                end_idx = start_idx
                in_string = False
                escape_next = False
                
                for i in range(start_idx, len(text)):
                    char = text[i]
                    if escape_next:
                        escape_next = False
                        continue
                    if char == '\\':
                        escape_next = True
                        continue
                    if char == '"' and not escape_next:
                        in_string = not in_string
                        continue
                    if not in_string:
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                end_idx = i
                                break
                
                if brace_count == 0 and end_idx > start_idx:
                    json_str = text[start_idx:end_idx + 1]
                    # 尝试修复控制字符
                    json_str = QuizPaperService._fix_control_characters_in_json(json_str)
                    
                    try:
                        data = json.loads(json_str)
                        if isinstance(data, dict) and "questions" in data:
                            questions = data.get("questions", [])
                            if questions and isinstance(questions, list):
                                if questions and isinstance(questions[0], str):
                                    parsed = []
                                    for q_str in questions:
                                        try:
                                            q_obj = json.loads(q_str.strip())
                                            if isinstance(q_obj, dict) and "question" in q_obj:
                                                parsed.append(q_obj)
                                        except:
                                            continue
                                    if parsed:
                                        logger.info(f"方法2（完整JSON+字符串数组）成功：解析到{len(parsed)}道题目")
                                        return parsed
                                elif questions and isinstance(questions[0], dict):
                                    logger.info(f"方法2（完整JSON）成功：解析到{len(questions)}道题目")
                                    return questions
                    except json.JSONDecodeError as e:
                        logger.debug(f"方法2 JSON解析失败: {e}")
        except Exception as e:
            logger.debug(f"方法2失败: {e}")
        
        # 方法3: 直接从文本中提取所有JSON对象
        questions = QuizPaperService._extract_objects_from_text(text)
        if questions:
            logger.info(f"方法3（直接提取对象）成功：解析到{len(questions)}道题目")
            return questions
        
        logger.warning(f"所有解析方法都失败，文本前1000字符: {text[:1000]}")
        return []
        
        # 方法1: 尝试提取完整的JSON对象 {"questions": [...]}
        # 使用平衡括号算法找到完整的JSON对象
        try:
            start_idx = text.find('{')
            if start_idx == -1:
                raise ValueError("未找到JSON开始标记")
            
            # 使用栈来找到匹配的结束括号
            brace_count = 0
            end_idx = start_idx
            in_string = False
            escape_next = False
            
            for i in range(start_idx, len(text)):
                char = text[i]
                
                if escape_next:
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                    continue
                
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = i
                            break
            
            # 如果找到了完整的JSON对象
            if brace_count == 0 and end_idx > start_idx:
                json_str = text[start_idx:end_idx + 1]
                
                # 尝试修复常见的JSON错误
                json_str = QuizPaperService._fix_json_errors(json_str)
                
                try:
                    data = json.loads(json_str)
                    if isinstance(data, dict) and "questions" in data:
                        questions = data.get("questions", [])
                        if questions and isinstance(questions, list):
                            # 检查questions是否是字符串数组（AI错误格式）
                            if questions and isinstance(questions[0], str):
                                logger.warning("检测到questions是字符串数组，尝试解析每个字符串为JSON对象")
                                parsed_questions = []
                                for q_str in questions:
                                    try:
                                        q_obj = json.loads(q_str.strip())
                                        if isinstance(q_obj, dict) and "question" in q_obj:
                                            parsed_questions.append(q_obj)
                                    except (json.JSONDecodeError, ValueError):
                                        continue
                                if parsed_questions:
                                    logger.info(f"方法1（字符串数组修复）成功：解析到{len(parsed_questions)}道题目")
                                    return parsed_questions
                            elif questions and isinstance(questions[0], dict):
                                logger.info(f"方法1成功：解析到{len(questions)}道题目")
                                return questions
                except json.JSONDecodeError as e:
                    logger.warning(f"方法1 JSON解析失败: {e}, JSON前500字符: {json_str[:500]}")
                    logger.warning(f"方法1 JSON后500字符: {json_str[-500:]}")
                    # 如果完整JSON解析失败，尝试提取questions数组
                    questions = QuizPaperService._extract_questions_from_incomplete_json(json_str)
                    if questions:
                        logger.info(f"方法1（修复模式）成功：解析到{len(questions)}道题目")
                        return questions
            else:
                # JSON可能被截断，尝试提取部分内容
                logger.debug(f"JSON可能被截断（brace_count={brace_count}），尝试提取部分内容")
                json_str = text[start_idx:]  # 提取到文本末尾
                questions = QuizPaperService._extract_questions_from_incomplete_json(json_str)
                if questions:
                    logger.info(f"方法1（截断模式）成功：解析到{len(questions)}道题目")
                    return questions
        except Exception as e:
            logger.debug(f"方法1解析失败: {e}")
        
        # 方法2: 尝试直接提取questions数组（支持截断）
        try:
            # 查找 "questions": [ 的开始位置
            questions_start = text.find('"questions"')
            if questions_start != -1:
                # 找到数组开始 [
                array_start = text.find('[', questions_start)
                if array_start != -1:
                    # 提取数组内容（支持截断）
                    questions = QuizPaperService._extract_questions_from_array(text, array_start)
                    if questions:
                        logger.info(f"方法2成功：解析到{len(questions)}道题目")
                        return questions
        except Exception as e:
            logger.debug(f"方法2解析失败: {e}")
        
        # 方法3: 尝试直接提取JSON数组
        try:
            array_start = text.find('[')
            if array_start != -1:
                questions = QuizPaperService._extract_questions_from_array(text, array_start)
                if questions:
                    logger.info(f"方法3成功：解析到{len(questions)}道题目")
                    return questions
        except Exception as e:
            logger.debug(f"方法3解析失败: {e}")
        
        logger.warning(f"所有解析方法都失败，文本前1000字符: {text[:1000]}")
        return []
    
    @staticmethod
    def _extract_objects_from_text(text: str) -> List[Dict]:
        """从文本中直接提取所有JSON对象（不依赖questions字段）"""
        import json
        questions = []
        
        # 使用平衡括号算法提取所有完整的JSON对象
        i = 0
        while i < len(text):
            # 找到下一个 {
            if text[i] != '{':
                i += 1
                continue
            
            # 找到匹配的 }
            start_idx = i
            brace_count = 0
            in_string = False
            escape_next = False
            end_idx = -1
            
            for j in range(start_idx, len(text)):
                char = text[j]
                if escape_next:
                    escape_next = False
                    continue
                if char == '\\':
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = j
                            break
            
            if end_idx != -1:
                obj_str = text[start_idx:end_idx + 1]
                try:
                    obj = json.loads(obj_str)
                    if isinstance(obj, dict) and "question" in obj and "answer" in obj:
                        # 确保有type字段
                        if "type" not in obj:
                            obj["type"] = "choice" if "options" in obj else "fill"
                        # 确保有difficulty字段
                        if "difficulty" not in obj:
                            obj["difficulty"] = "medium"
                        # 确保difficulty是有效值
                        if obj["difficulty"] not in ["easy", "medium", "hard"]:
                            obj["difficulty"] = "medium"
                        questions.append(obj)
                except:
                    pass
                
                i = end_idx + 1
            else:
                break
        
        return questions
    
    @staticmethod
    def _fix_control_characters_in_json(json_str: str) -> str:
        """修复JSON字符串中的控制字符"""
        import re
        
        # 在字符串值中，将未转义的换行符、回车符、制表符转换为转义序列
        # 但要注意不要破坏已经转义的字符
        
        # 匹配字符串值: "field": "value with \n newline"
        def fix_string(match):
            full_match = match.group(0)
            # 只处理值部分
            if ':' in full_match:
                parts = full_match.split(':', 1)
                if len(parts) == 2:
                    key = parts[0]
                    value = parts[1].strip()
                    # 如果值以引号开始和结束
                    if value.startswith('"') and value.endswith('"'):
                        content = value[1:-1]
                        # 将未转义的控制字符转换为转义序列
                        content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                        return f'{key}: "{content}"'
            return full_match
        
        # 匹配所有 "field": "value" 模式
        json_str = re.sub(r'"[^"]*"\s*:\s*"[^"]*"', fix_string, json_str)
        
        return json_str
    
    @staticmethod
    def _fix_json_errors(json_str: str) -> str:
        """修复常见的JSON格式错误"""
        import re
        
        # 1. 修复未闭合的字符串（在字段值中）
        # 匹配 "field": "value 后面没有闭合引号的情况
        json_str = re.sub(r'("(?:[^"\\]|\\.)*?)(?:\n|$)(?![,}\]])', r'\1"', json_str)
        
        # 2. 修复 difficulty 字段常见错误（如 "difficulty": "ea -> "difficulty": "easy"）
        json_str = re.sub(r'"difficulty"\s*:\s*"ea[^"]*', '"difficulty": "easy"', json_str)
        json_str = re.sub(r'"difficulty"\s*:\s*"me[^"]*', '"difficulty": "medium"', json_str)
        json_str = re.sub(r'"difficulty"\s*:\s*"ha[^"]*', '"difficulty": "hard"', json_str)
        
        # 3. 修复缺少逗号的情况（对象之间）
        json_str = re.sub(r'}\s*\n\s*{', '},\n    {', json_str)
        
        # 4. 修复数组末尾缺少逗号
        json_str = re.sub(r'(\])\s*(\n\s*[}\]])', r'\1,\2', json_str)
        
        return json_str
    
    @staticmethod
    def _extract_questions_from_array(text: str, array_start: int) -> List[Dict]:
        """从文本中提取questions数组，支持截断的JSON"""
        import re
        questions = []
        
        # 从array_start开始，找到数组内容
        # 使用平衡括号算法找到完整的数组（或尽可能多的内容）
        bracket_count = 0
        end_idx = array_start
        in_string = False
        escape_next = False
        
        for i in range(array_start, len(text)):
            char = text[i]
            
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            
            if not in_string:
                if char == '[':
                    bracket_count += 1
                elif char == ']':
                    bracket_count -= 1
                    if bracket_count == 0:
                        end_idx = i
                        break
        
        # 提取数组内容
        if end_idx > array_start:
            array_content = text[array_start + 1:end_idx]  # 跳过开始的 [
            logger.debug(f"_extract_questions_from_array: 找到完整数组，长度: {len(array_content)}字符")
        else:
            # JSON可能被截断，提取到文本末尾
            array_content = text[array_start + 1:]
            logger.debug(f"_extract_questions_from_array: 数组可能被截断，提取到末尾，长度: {len(array_content)}字符")
        
        # 提取每个题目对象
        questions = QuizPaperService._extract_question_objects(array_content)
        logger.debug(f"_extract_questions_from_array: 提取到{len(questions)}道题目")
        return questions
    
    @staticmethod
    def _extract_questions_from_incomplete_json(json_str: str) -> List[Dict]:
        """从不完整的JSON中提取题目（处理截断情况）"""
        import re
        questions = []
        
        # 尝试找到questions数组部分
        # 先尝试匹配正常的对象数组格式
        questions_match = re.search(r'"questions"\s*:\s*\[(.*?)\]', json_str, re.DOTALL)
        if questions_match:
            array_content = questions_match.group(1)
            logger.debug(f"找到questions数组内容，长度: {len(array_content)}字符")
            # 提取尽可能多的题目对象
            questions = QuizPaperService._extract_question_objects(array_content)
            if questions:
                return questions
        
        # 如果没找到，尝试匹配字符串数组格式（AI错误格式）
        # 格式: "questions": ["    { ... }", "    { ... }"]
        # 先尝试找到questions数组的开始位置
        array_start = json_str.find('"questions"')
        if array_start != -1:
            bracket_start = json_str.find('[', array_start)
            if bracket_start != -1:
                # 找到匹配的 ]
                bracket_count = 0
                in_string = False
                escape_next = False
                bracket_end = -1
                
                for i in range(bracket_start, len(json_str)):
                    char = json_str[i]
                    if escape_next:
                        escape_next = False
                        continue
                    if char == '\\':
                        escape_next = True
                        continue
                    if char == '"' and not escape_next:
                        in_string = not in_string
                        continue
                    if not in_string:
                        if char == '[':
                            bracket_count += 1
                        elif char == ']':
                            bracket_count -= 1
                            if bracket_count == 0:
                                bracket_end = i
                                break
                
                if bracket_end != -1:
                    array_content = json_str[bracket_start + 1:bracket_end]
                    logger.debug(f"找到questions数组内容，长度: {len(array_content)}字符，前200字符: {array_content[:200]}")
                    
                    # 检查是否是字符串数组格式
                    array_content_stripped = array_content.strip()
                    if array_content_stripped.startswith('"'):
                        logger.warning("检测到questions是字符串数组格式，尝试特殊处理")
                        # 这是字符串数组，需要特殊处理
                        questions = QuizPaperService._extract_questions_from_string_array(array_content)
                        if questions:
                            return questions
                    else:
                        # 尝试作为普通对象数组解析
                        questions = QuizPaperService._extract_question_objects(array_content)
                        if questions:
                            return questions
        
        # 如果没找到"questions"字段，尝试直接查找数组
        array_match = re.search(r'\[(.*)', json_str, re.DOTALL)
        if array_match:
            array_content = array_match.group(1)
            logger.debug(f"直接找到数组内容，长度: {len(array_content)}字符")
            questions = QuizPaperService._extract_question_objects(array_content)
        
        return questions
    
    @staticmethod
    def _extract_questions_from_string_array(array_content: str) -> List[Dict]:
        """从字符串数组中提取题目（处理AI返回的字符串数组格式）"""
        import re
        import json
        questions = []
        
        logger.debug(f"_extract_questions_from_string_array: 输入内容前200字符: {array_content[:200]}")
        
        # 方法1: 尝试直接解析整个数组内容为JSON
        # 如果array_content是 "    { ... }", "    { ... }" 格式
        try:
            # 尝试用 [ 和 ] 包裹，然后解析
            array_str = "[" + array_content.strip() + "]"
            # 移除末尾多余的逗号
            array_str = re.sub(r',\s*\]', ']', array_str)
            data = json.loads(array_str)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, str):
                        # 如果是字符串，尝试解析为JSON对象
                        try:
                            q_obj = json.loads(item.strip())
                            if isinstance(q_obj, dict) and "question" in q_obj:
                                questions.append(q_obj)
                        except (json.JSONDecodeError, ValueError):
                            continue
                    elif isinstance(item, dict) and "question" in item:
                        questions.append(item)
                if questions:
                    logger.info(f"_extract_questions_from_string_array（直接解析）成功提取{len(questions)}道题目")
                    return questions
        except (json.JSONDecodeError, ValueError) as e:
            logger.debug(f"_extract_questions_from_string_array（直接解析）失败: {e}")
        
        # 方法2: 使用正则表达式提取所有被引号包裹的字符串
        # 格式: "    { ... }", "    { ... }"
        # 注意：字符串可能包含换行符，需要使用DOTALL模式
        string_pattern = r'"((?:[^"\\]|\\.|\\n|\\r|\\t)*)"'
        matches = list(re.finditer(string_pattern, array_content, re.DOTALL))
        
        logger.debug(f"_extract_questions_from_string_array: 找到{len(matches)}个字符串匹配")
        
        for idx, match in enumerate(matches):
            string_content = match.group(1)
            logger.debug(f"_extract_questions_from_string_array: 处理第{idx+1}个字符串，长度: {len(string_content)}字符")
            
            # 处理转义字符
            # 注意：这里需要小心处理，因为JSON字符串中的\n已经是转义序列
            # 如果string_content中有实际的换行符，需要先转换为\n
            string_content = string_content.replace('\r\n', '\\n').replace('\r', '\\n').replace('\n', '\\n')
            string_content = string_content.replace('\t', '\\t')
            
            # 尝试解析为JSON对象
            try:
                q_obj = json.loads(string_content.strip())
                if isinstance(q_obj, dict) and "question" in q_obj:
                    # 确保有type字段
                    if "type" not in q_obj:
                        q_obj["type"] = "choice" if "options" in q_obj else "fill"
                    # 确保有difficulty字段
                    if "difficulty" not in q_obj:
                        q_obj["difficulty"] = "medium"
                    # 确保difficulty是有效值
                    if q_obj["difficulty"] not in ["easy", "medium", "hard"]:
                        q_obj["difficulty"] = "medium"
                    questions.append(q_obj)
                    logger.debug(f"_extract_questions_from_string_array: 成功解析第{idx+1}个对象")
            except (json.JSONDecodeError, ValueError) as e:
                logger.debug(f"解析字符串数组中的对象失败: {e}, 内容前200字符: {string_content[:200]}")
                # 如果解析失败，尝试直接提取对象内容（忽略引号）
                try:
                    # 尝试找到第一个 { 和最后一个 }
                    start_idx = string_content.find('{')
                    end_idx = string_content.rfind('}')
                    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                        obj_str = string_content[start_idx:end_idx + 1]
                        q_obj = json.loads(obj_str)
                        if isinstance(q_obj, dict) and "question" in q_obj:
                            if "type" not in q_obj:
                                q_obj["type"] = "choice" if "options" in q_obj else "fill"
                            if "difficulty" not in q_obj:
                                q_obj["difficulty"] = "medium"
                            if q_obj["difficulty"] not in ["easy", "medium", "hard"]:
                                q_obj["difficulty"] = "medium"
                            questions.append(q_obj)
                            logger.debug(f"_extract_questions_from_string_array: 通过备用方法成功解析第{idx+1}个对象")
                except Exception:
                    continue
        
        if questions:
            logger.info(f"_extract_questions_from_string_array成功提取{len(questions)}道题目")
        else:
            logger.warning(f"_extract_questions_from_string_array未能提取任何题目，输入内容前500字符: {array_content[:500]}")
        
        return questions
    
    @staticmethod
    def _extract_question_objects(content: str) -> List[Dict]:
        """从内容中提取题目对象，支持截断的JSON"""
        import re
        questions = []
        
        # 使用平衡括号算法提取每个完整的对象
        i = 0
        max_iterations = 1000  # 防止无限循环
        iteration = 0
        
        while i < len(content) and iteration < max_iterations:
            iteration += 1
            
            # 跳过空白字符和逗号
            while i < len(content) and (content[i].isspace() or content[i] == ','):
                i += 1
            
            if i >= len(content):
                break
            
            # 找到下一个 { 开始
            if content[i] != '{':
                i += 1
                continue
            
            # 找到匹配的 }
            start_idx = i
            brace_count = 0
            in_string = False
            escape_next = False
            end_idx = -1
            
            for j in range(start_idx, len(content)):
                char = content[j]
                
                if escape_next:
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                    continue
                
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = j
                            break
            
            if end_idx != -1:
                obj_str = content[start_idx:end_idx + 1]
                try:
                    # 尝试修复常见的错误
                    obj_str = QuizPaperService._fix_json_errors(obj_str)
                    obj = json.loads(obj_str)
                    
                    # 验证必需字段
                    if isinstance(obj, dict) and "question" in obj and "answer" in obj:
                        # 确保有type字段
                        if "type" not in obj:
                            obj["type"] = "choice" if "options" in obj else "fill"
                        # 确保有difficulty字段
                        if "difficulty" not in obj:
                            obj["difficulty"] = "medium"
                        # 确保difficulty是有效值
                        if obj["difficulty"] not in ["easy", "medium", "hard"]:
                            obj["difficulty"] = "medium"
                        
                        questions.append(obj)
                        logger.debug(f"成功解析题目对象 {len(questions)}: {obj.get('question', '')[:50]}...")
                except (json.JSONDecodeError, ValueError) as e:
                    logger.debug(f"解析单个题目对象失败: {e}, 对象前150字符: {obj_str[:150]}")
                
                i = end_idx + 1
            else:
                # 没有找到匹配的}，可能JSON被截断了
                # 尝试提取部分对象（如果至少有一些字段）
                logger.debug(f"未找到匹配的}}，可能JSON被截断，已提取{len(questions)}道题目")
                break
        
        if questions:
            logger.info(f"_extract_question_objects成功提取{len(questions)}道题目")
        else:
            logger.warning(f"_extract_question_objects未能提取任何题目，内容前200字符: {content[:200]}")
        
        return questions
    
    @staticmethod
    def _generate_answer_key(questions: List[Dict]) -> Dict[str, Any]:
        """生成标准答案"""
        answer_key = {}
        for i, q in enumerate(questions):
            answer_key[str(i + 1)] = {
                "answer": q.get("answer", ""),
                "points": q.get("points", 5),
                "knowledge_point": q.get("knowledge_point", "")
            }
        return answer_key
    
    @staticmethod
    def get_paper(db: Session, paper_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """获取试卷详情"""
        paper = QuizPaperRepository.get_by_id(db, paper_id, user_id)
        if not paper:
            return None
        
        return {
            "id": paper.id,
            "title": paper.title,
            "subject": paper.subject,
            "grade_level": paper.grade_level,
            "total_questions": paper.total_questions,
            "questions": paper.questions,
            "answer_key": paper.answer_key,
            "time_limit": paper.time_limit,
            "total_score": paper.total_score,
            "created_at": (paper.created_at + timedelta(hours=8)).isoformat() if paper.created_at else None
        }
    
    @staticmethod
    def list_papers(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """获取用户的试卷列表"""
        papers = QuizPaperRepository.list_by_user(db, user_id, skip, limit)
        return [
            {
                "id": p.id,
                "title": p.title,
                "subject": p.subject,
                "grade_level": p.grade_level,
                "total_questions": p.total_questions,
                "total_score": p.total_score,
                "paper_type": p.paper_type,
                "created_at": (p.created_at + timedelta(hours=8)).isoformat() if p.created_at else None
            }
            for p in papers
        ]

    @staticmethod
    def delete_paper(db: Session, paper_id: int, user_id: int) -> bool:
        return QuizPaperRepository.delete(db, paper_id, user_id)
    
    @staticmethod
    def save_template(
        db: Session,
        user_id: int,
        template_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """保存试卷模板"""
        template = PaperTemplateRepository.create(
            db=db,
            user_id=user_id,
            name=template_data.get("name"),
            description=template_data.get("description"),
            paper_title=template_data.get("paper_title"),
            subject=template_data.get("subject"),
            grade_level=template_data.get("grade_level"),
            total_questions=template_data.get("total_questions", 20),
            difficulty_distribution=template_data.get("difficulty_distribution"),
            question_type_distribution=template_data.get("question_type_distribution"),
            knowledge_points=template_data.get("knowledge_points"),
            time_limit=template_data.get("time_limit"),
            total_score=template_data.get("total_score", 100)
        )
        
        return {
            "id": template.id,
            "name": template.name,
            "description": template.description
        }
    
    @staticmethod
    def list_templates(db: Session, user_id: int) -> List[Dict[str, Any]]:
        """获取用户的模板列表"""
        templates = PaperTemplateRepository.list_by_user(db, user_id)
        return [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "paper_title": t.paper_title,
                "subject": t.subject,
                "grade_level": t.grade_level,
                "total_questions": t.total_questions,
                "difficulty_distribution": t.difficulty_distribution,
                "question_type_distribution": t.question_type_distribution,
                "knowledge_points": t.knowledge_points,
                "time_limit": t.time_limit,
                "total_score": t.total_score,
                "usage_count": t.usage_count,
                "created_at": t.created_at.isoformat() if t.created_at else None
            }
            for t in templates
        ]
    
    @staticmethod
    def delete_template(db: Session, template_id: int, user_id: int) -> Dict[str, Any]:
        """删除模板"""
        success = PaperTemplateRepository.delete(db, template_id, user_id)
        if success:
            return {"success": True, "message": "模板删除成功"}
        else:
            raise ValueError("模板不存在或无权删除")

