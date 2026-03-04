"""
模板推荐服务
作者：智学伴开发团队
目的：使用AI搜索并推荐符合实际情况的试卷模板参数
"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from services.ai_service import AIService
from core.logger import logger
import json
import re


class TemplateRecommendationService:
    """模板推荐服务类"""
    
    @staticmethod
    def _get_standard_params(grade_level: str, subject: Optional[str] = None) -> Dict[str, Any]:
        """获取标准参数（基于实际考试标准）"""
        if grade_level == "高中":
            if subject == "语文":
                return {
                    "total_questions": 23,
                    "question_type_distribution": {
                        "choice": 13,  # 语言文字运用选择题 + 阅读选择题
                        "fill": 5,     # 名句默写 + 文言文填空
                        "essay": 4,    # 阅读简答题
                        "composition": 1,  # 作文
                        "multiple_choice": 0,
                        "judge": 0,
                        "calculation": 0,
                        "comprehensive": 0
                    },
                    "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                    "time_limit": 150,
                    "total_score": 150,
                    "description": "高考语文标准：23题，150分，150分钟。题型：选择题13题（语言文字运用+阅读），填空题5题（名句默写+文言文），简答题4题（阅读），作文1题。难度：基础30%，中等50%，难题20%。"
                }
            elif subject == "数学":
                return {
                    "total_questions": 22,
                    "question_type_distribution": {
                        "choice": 8,   # 选择题
                        "fill": 6,     # 填空题
                        "calculation": 8,  # 解答题
                        "multiple_choice": 0,
                        "judge": 0,
                        "essay": 0,
                        "comprehensive": 0,
                        "composition": 0
                    },
                    "difficulty_distribution": {"easy": 25, "medium": 50, "hard": 25},
                    "time_limit": 120,
                    "total_score": 150,
                    "description": "高考数学标准：22题，150分，120分钟。题型：选择题8题，填空题6题，解答题8题。难度：基础25%，中等50%，难题25%。"
                }
            elif subject == "英语":
                return {
                    "total_questions": 80,
                    "question_type_distribution": {
                        "choice": 60,  # 听力、阅读、完形等选择题
                        "fill": 10,    # 语法填空
                        "essay": 10,   # 短文改错、书面表达等
                        "multiple_choice": 0,
                        "judge": 0,
                        "calculation": 0,
                        "comprehensive": 0,
                        "composition": 0
                    },
                    "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                    "time_limit": 120,
                    "total_score": 150,
                    "description": "高考英语标准：约80题，150分，120分钟。题型：选择题60题（听力、阅读、完形），填空题10题（语法填空），简答题10题（改错、写作）。难度：基础30%，中等50%，难题20%。"
                }
            else:
                # 高中其他科目通用标准
                return {
                    "total_questions": 30,
                    "question_type_distribution": {
                        "choice": 12,
                        "multiple_choice": 4,
                        "fill": 6,
                        "essay": 8,
                        "judge": 0,
                        "calculation": 0,
                        "comprehensive": 0,
                        "composition": 0
                    },
                    "difficulty_distribution": {"easy": 20, "medium": 55, "hard": 25},
                    "time_limit": 120,
                    "total_score": 150,
                    "description": "高中通用标准：30题，150分，120分钟。题型：选择题12题，多选题4题，填空题6题，简答题8题。难度：基础20%，中等55%，难题25%。"
                }
        elif grade_level == "初中":
            return {
                "total_questions": 25,
                "question_type_distribution": {
                    "choice": 10,
                    "fill": 6,
                    "essay": 9,
                    "multiple_choice": 0,
                    "judge": 0,
                    "calculation": 0,
                    "comprehensive": 0,
                    "composition": 0
                },
                "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                "time_limit": 120,
                "total_score": 150,
                "description": "初中标准：25题，150分，120分钟。题型：选择题10题，填空题6题，简答题9题。难度：基础30%，中等50%，难题20%。"
            }
        elif grade_level == "小学":
            return {
                "total_questions": 25,
                "question_type_distribution": {
                    "choice": 15,
                    "fill": 6,
                    "judge": 4,
                    "multiple_choice": 0,
                    "essay": 0,
                    "calculation": 0,
                    "comprehensive": 0,
                    "composition": 0
                },
                "difficulty_distribution": {"easy": 70, "medium": 25, "hard": 5},
                "time_limit": 60,
                "total_score": 100,
                "description": "小学标准：25题，100分，60分钟。题型：选择题15题，填空题6题，判断题4题。难度：基础70%，中等25%，难题5%。"
            }
        else:  # 大学
            return {
                "total_questions": 30,
                "question_type_distribution": {
                    "choice": 12,
                    "fill": 6,
                    "calculation": 6,
                    "essay": 6,
                    "multiple_choice": 0,
                    "judge": 0,
                    "comprehensive": 0,
                    "composition": 0
                },
                "difficulty_distribution": {"easy": 25, "medium": 50, "hard": 25},
                "time_limit": 120,
                "total_score": 100,
                "description": "大学标准：30题，100分，120分钟。题型：选择题12题，填空题6题，计算题6题，简答题6题。难度：基础25%，中等50%，难题25%。"
            }
    
    @staticmethod
    def get_recommended_template(
        db: Session,
        grade_level: str,
        subject: Optional[str] = None,
        total_questions: Optional[int] = None,
        provider: Optional[str] = None,
        time_limit: Optional[int] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        使用AI搜索并获取推荐的模板参数
        
        Args:
            db: 数据库会话
            grade_level: 学段（小学/初中/高中/大学）
            subject: 科目（可选）
            total_questions: 总题数（可选，AI可推荐）
            provider: AI提供商（可选）
            time_limit: 考试时长（分钟，可选，AI可推荐）
            title: 试卷标题（可选，用于AI推荐）
        
        Returns:
            Dict: 包含推荐的题型分布、难度分布、总题数、考试时长等参数
        """
        try:
            # 根据科目和学段确定标准参数
            standard_params = TemplateRecommendationService._get_standard_params(grade_level, subject)
            
            # 确定最终使用的参数（用户设置优先，否则使用标准值）
            final_total_questions = total_questions if total_questions else standard_params.get('total_questions', 20)
            final_time_limit = time_limit if time_limit else standard_params.get('time_limit', 120)
            final_total_score = standard_params.get('total_score', 150)
            
            # 根据最终总题数调整题型分布（按比例缩放，保持比例）
            final_question_type_dist = standard_params.get('question_type_distribution', {}).copy()
            
            # 确保所有题型字段都存在
            all_type_keys = ["choice", "multiple_choice", "fill", "judge", "essay", "calculation", "comprehensive", "composition"]
            for key in all_type_keys:
                if key not in final_question_type_dist:
                    final_question_type_dist[key] = 0
            
            standard_sum = sum(final_question_type_dist.values())
            
            # 如果用户设置的总题数与标准总题数不同，需要按比例调整
            if standard_sum > 0 and standard_sum != final_total_questions:
                # 计算缩放比例
                ratio = final_total_questions / standard_sum
                
                # 先按比例缩放所有题型（保留小数，用于后续精确调整）
                scaled_dist = {}
                for key in final_question_type_dist:
                    scaled_dist[key] = final_question_type_dist[key] * ratio
                
                # 先向下取整，确保总和不超过目标
                for key in scaled_dist:
                    final_question_type_dist[key] = max(0, int(scaled_dist[key]))
                
                # 计算当前总和与目标的差值
                current_sum = sum(final_question_type_dist.values())
                diff = final_total_questions - current_sum
                
                # 如果有差值，按小数部分大小分配（优先分配给小数部分大的题型）
                if diff != 0:
                    # 计算每个题型的小数部分
                    fractional_parts = []
                    for key in all_type_keys:
                        if scaled_dist.get(key, 0) > 0:
                            fractional = scaled_dist[key] - int(scaled_dist[key])
                            fractional_parts.append((key, fractional))
                    
                    # 按小数部分从大到小排序
                    fractional_parts.sort(key=lambda x: x[1], reverse=True)
                    
                    # 分配差值（向上取整）
                    for i in range(abs(diff)):
                        if i < len(fractional_parts):
                            key = fractional_parts[i][0]
                            final_question_type_dist[key] = final_question_type_dist.get(key, 0) + (1 if diff > 0 else -1)
            
            final_difficulty_dist = standard_params.get('difficulty_distribution', {"easy": 30, "medium": 50, "hard": 20})
            
            # 记录题型分布详情
            logger.info(f"标准题型分布：{json.dumps(standard_params.get('question_type_distribution', {}), ensure_ascii=False)}，标准总和={standard_sum}")
            logger.info(f"调整后题型分布：{json.dumps(final_question_type_dist, ensure_ascii=False)}，总和={sum(final_question_type_dist.values())}，目标={final_total_questions}")
            
            # 直接返回标准参数，不需要AI推荐
            logger.info(f"使用标准参数：{grade_level}{subject or ''}，总题数={final_total_questions}，时长={final_time_limit}分钟")
            logger.info(f"题型分布详情：{json.dumps(final_question_type_dist, ensure_ascii=False)}")
            logger.info(f"题型分布总和：{sum(final_question_type_dist.values())}，期望：{final_total_questions}")
            
            return {
                "total_questions": final_total_questions,
                "question_type_distribution": final_question_type_dist,
                "difficulty_distribution": final_difficulty_dist,
                "time_limit": final_time_limit,
                "total_score": final_total_score,
                "reasoning": f"基于{grade_level}{subject or ''}的实际考试标准配置，题型分布：{json.dumps({k: v for k, v in final_question_type_dist.items() if v > 0}, ensure_ascii=False)}"
            }
            
        except Exception as e:
            logger.error(f"获取AI推荐失败: {e}", exc_info=True)
            # 返回默认推荐（基于规则）
            return TemplateRecommendationService._get_default_recommendation(
                grade_level, subject, total_questions
            )
    
    @staticmethod
    def _parse_recommendation(
        ai_text: str, 
        total_questions: Optional[int],
        time_limit: Optional[int] = None,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None
    ) -> Dict[str, Any]:
        """解析AI返回的推荐JSON"""
        try:
            # 尝试提取JSON
            json_str = TemplateRecommendationService._extract_json(ai_text)
            logger.debug(f"提取的JSON字符串: {json_str[:500]}...")  # 只记录前500字符
            
            # 清理JSON字符串中的常见问题
            json_str = TemplateRecommendationService._clean_json_string(json_str)
            
            recommendation = json.loads(json_str)
            
            # 验证和修正数据（传入grade_level和subject用于获取标准参数）
            recommendation = TemplateRecommendationService._validate_and_fix(
                recommendation, total_questions, time_limit, grade_level, subject
            )
            
            return recommendation
        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析失败: {e}")
            logger.debug(f"原始文本: {ai_text[:500]}...")
            default_total = total_questions if total_questions else 20
            return TemplateRecommendationService._get_default_recommendation(
                grade_level or "高中", subject, default_total
            )
        except Exception as e:
            logger.warning(f"解析AI推荐失败，使用默认值: {e}", exc_info=True)
            default_total = total_questions if total_questions else 20
            return TemplateRecommendationService._get_default_recommendation(
                grade_level or "高中", subject, default_total
            )
    
    @staticmethod
    def _extract_json(text: str) -> str:
        """从文本中提取JSON"""
        # 尝试直接解析
        text = text.strip()
        if text.startswith('{') and text.endswith('}'):
            return text
        
        # 尝试提取代码块中的JSON
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        if json_match:
            return json_match.group(1)
        
        # 尝试提取第一个完整的JSON对象
        brace_count = 0
        start_idx = -1
        for i, char in enumerate(text):
            if char == '{':
                if start_idx == -1:
                    start_idx = i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and start_idx != -1:
                    return text[start_idx:i+1]
        
        # 如果都失败，返回原文本
        return text
    
    @staticmethod
    def _clean_json_string(json_str: str) -> str:
        """清理JSON字符串中的常见问题"""
        # 移除可能的BOM标记
        if json_str.startswith('\ufeff'):
            json_str = json_str[1:]
        
        # 移除前后的空白字符
        json_str = json_str.strip()
        
        # 尝试修复常见的JSON问题
        # 1. 移除可能的markdown代码块标记
        json_str = re.sub(r'^```(?:json)?\s*', '', json_str, flags=re.MULTILINE)
        json_str = re.sub(r'\s*```\s*$', '', json_str, flags=re.MULTILINE)
        
        # 2. 修复单引号为双引号（如果整个字符串都是单引号）
        if json_str.startswith("'") and json_str.endswith("'"):
            json_str = json_str[1:-1]
            json_str = json_str.replace("'", '"')
        
        # 3. 移除可能的注释（JSON不支持注释，但AI可能添加）
        json_str = re.sub(r'//.*?$', '', json_str, flags=re.MULTILINE)
        json_str = re.sub(r'/\*.*?\*/', '', json_str, flags=re.DOTALL)
        
        return json_str.strip()
    
    @staticmethod
    def _validate_and_fix(
        recommendation: Dict[str, Any], 
        total_questions: Optional[int],
        time_limit: Optional[int] = None,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None
    ) -> Dict[str, Any]:
        """验证并修正推荐数据，确保符合实际标准"""
        # 获取标准参数作为参考
        if grade_level:
            standard_params = TemplateRecommendationService._get_standard_params(grade_level, subject)
        else:
            standard_params = {}
        
        # 确保总题数存在（如果用户未设置，使用AI推荐的；如果AI未推荐，使用标准值）
        if "total_questions" not in recommendation or not recommendation["total_questions"]:
            if total_questions:
                recommendation["total_questions"] = total_questions
            elif standard_params:
                recommendation["total_questions"] = standard_params.get("total_questions", 20)
            else:
                recommendation["total_questions"] = 20  # 默认值
        elif total_questions:
            # 如果用户已设置，优先使用用户设置的值
            recommendation["total_questions"] = total_questions
        
        final_total_questions = recommendation["total_questions"]
        
        # 确保题型分布存在（优先使用标准参数）
        if standard_params and "question_type_distribution" in standard_params:
            # 如果有标准参数，使用标准题型分布作为基础
            recommendation["question_type_distribution"] = standard_params["question_type_distribution"].copy()
            # 但需要根据final_total_questions调整
            standard_sum = sum(recommendation["question_type_distribution"].values())
            if standard_sum != final_total_questions:
                # 按比例调整标准分布
                if standard_sum > 0:
                    ratio = final_total_questions / standard_sum
                    for key in recommendation["question_type_distribution"]:
                        recommendation["question_type_distribution"][key] = \
                            max(0, int(recommendation["question_type_distribution"][key] * ratio))
        elif "question_type_distribution" not in recommendation:
            recommendation["question_type_distribution"] = {}
        
        # 确保所有题型字段存在
        type_keys = ["choice", "multiple_choice", "fill", "judge", "essay", "calculation", "comprehensive", "composition"]
        for key in type_keys:
            if key not in recommendation["question_type_distribution"]:
                recommendation["question_type_distribution"][key] = 0
        
        # 修正题型分布总和
        current_sum = sum(recommendation["question_type_distribution"].values())
        if current_sum != final_total_questions:
            diff = final_total_questions - current_sum
            # 调整最大的题型
            max_type = max(
                recommendation["question_type_distribution"].items(),
                key=lambda x: x[1]
            )[0]
            recommendation["question_type_distribution"][max_type] = \
                recommendation["question_type_distribution"].get(max_type, 0) + diff
        
        # 确保难度分布存在且总和为100（优先使用标准参数）
        if standard_params and "difficulty_distribution" in standard_params:
            # 如果有标准参数，优先使用标准难度分布
            recommendation["difficulty_distribution"] = standard_params["difficulty_distribution"].copy()
        elif "difficulty_distribution" not in recommendation:
            recommendation["difficulty_distribution"] = {"easy": 30, "medium": 50, "hard": 20}
        else:
            diff_sum = sum(recommendation["difficulty_distribution"].values())
            if diff_sum != 100:
                # 按比例调整
                if diff_sum > 0:
                    ratio = 100 / diff_sum
                    for key in recommendation["difficulty_distribution"]:
                        recommendation["difficulty_distribution"][key] = \
                            int(recommendation["difficulty_distribution"][key] * ratio)
                else:
                    recommendation["difficulty_distribution"] = {"easy": 30, "medium": 50, "hard": 20}
        
        # 确保时间限制和总分存在（如果用户已设置time_limit，优先使用用户设置的值）
        if "time_limit" not in recommendation or not recommendation["time_limit"]:
            # 如果用户传入了time_limit，使用用户设置的值；否则使用标准值
            recommendation["time_limit"] = time_limit if time_limit else (standard_params.get("time_limit", 90) if standard_params else 90)
        elif time_limit:
            # 如果用户传入了time_limit，优先使用用户设置的值
            recommendation["time_limit"] = time_limit
        
        # 确保总分存在（优先使用标准参数）
        if "total_score" not in recommendation or not recommendation["total_score"]:
            recommendation["total_score"] = standard_params.get("total_score", 100) if standard_params else 100
        
        # 确保推荐理由存在
        if "reasoning" not in recommendation:
            recommendation["reasoning"] = "基于该学段和科目的常见考试模式推荐"
        
        return recommendation
    
    @staticmethod
    def _get_default_recommendation(
        grade_level: str,
        subject: Optional[str],
        total_questions: int
    ) -> Dict[str, Any]:
        """获取基于规则的默认推荐（AI失败时的回退方案）"""
        if grade_level == "小学":
            return {
                "question_type_distribution": {
                    "choice": max(1, int(total_questions * 0.6)),
                    "fill": max(1, int(total_questions * 0.25)),
                    "judge": max(0, total_questions - int(total_questions * 0.6) - int(total_questions * 0.25)),
                    "multiple_choice": 0,
                    "essay": 0,
                    "calculation": 0,
                    "comprehensive": 0,
                    "composition": 0
                },
                "difficulty_distribution": {"easy": 70, "medium": 25, "hard": 5},
                "time_limit": 60,
                "total_score": 100,
                "reasoning": "小学阶段以基础题型为主，难度较低"
            }
        elif grade_level == "初中":
            return {
                "question_type_distribution": {
                    "choice": max(1, int(total_questions * 0.45)),
                    "fill": max(1, int(total_questions * 0.25)),
                "essay": max(0, total_questions - int(total_questions * 0.45) - int(total_questions * 0.25)),
                "multiple_choice": 0,
                "judge": 0,
                "calculation": 0,
                "comprehensive": 0,
                "composition": 0
                },
                "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                "time_limit": 120,
                "total_score": 150,
                "reasoning": "初中阶段开始引入简答题，难度适中"
            }
        elif grade_level == "高中":
            # 如果是语文科目，使用高考语文标准
            if subject == "语文":
                # 高考语文：20-23题，150分，150分钟
                # 题型分布：语言文字运用6题，现代文阅读7题，古代诗文阅读10题，写作1题
                # 简化映射：choice（选择题）约13题，fill（填空题）约5题，essay（简答题）约4题，composition（作文）1题
                return {
                    "question_type_distribution": {
                        "choice": max(1, int(total_questions * 0.57)),  # 约13题（语言文字运用+阅读选择题）
                        "fill": max(1, int(total_questions * 0.22)),  # 约5题（名句默写+文言文填空）
                        "essay": max(1, int(total_questions * 0.17)),  # 约4题（阅读简答题）
                        "composition": 1,  # 作文1题
                        "multiple_choice": 0,
                        "judge": 0,
                        "calculation": 0,
                        "comprehensive": 0
                    },
                    "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                    "time_limit": 150,  # 高考语文150分钟
                    "total_score": 150,
                    "reasoning": "高中语文参考高考标准：20-23题，包含语言文字运用、现代文阅读、古代诗文阅读、写作，总分150分，时长150分钟"
                }
            else:
                return {
                    "question_type_distribution": {
                        "choice": max(1, int(total_questions * 0.4)),
                        "multiple_choice": max(0, int(total_questions * 0.15)),
                        "fill": max(1, int(total_questions * 0.2)),
                        "essay": max(0, total_questions - int(total_questions * 0.4) - int(total_questions * 0.15) - int(total_questions * 0.2)),
                        "judge": 0,
                        "calculation": 0,
                        "comprehensive": 0,
                        "composition": 0
                    },
                    "difficulty_distribution": {"easy": 20, "medium": 55, "hard": 25},
                    "time_limit": 120,
                    "total_score": 150,
                    "reasoning": "高中阶段题型更丰富，包含多选题和简答题"
                }
        else:  # 大学
            return {
                "question_type_distribution": {
                    "choice": max(1, int(total_questions * 0.4)),
                    "fill": max(1, int(total_questions * 0.2)),
                    "calculation": max(0, int(total_questions * 0.25)),
                "essay": max(0, total_questions - int(total_questions * 0.4) - int(total_questions * 0.2) - int(total_questions * 0.25)),
                "multiple_choice": 0,
                "judge": 0,
                "comprehensive": 0,
                "composition": 0
                },
                "difficulty_distribution": {"easy": 25, "medium": 50, "hard": 25},
                "time_limit": 120,
                "total_score": 100,
                "reasoning": "大学阶段注重计算和综合分析能力"
            }

