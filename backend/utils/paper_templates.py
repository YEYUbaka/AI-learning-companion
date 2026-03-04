"""
试卷模板配置
作者：智学伴开发团队
目的：根据不同学段和科目提供标准化的题型分布模板
"""
from typing import Dict, Any, Optional


class PaperTemplates:
    """试卷模板类"""
    
    # 题型名称映射
    TYPE_NAMES = {
        "choice": "单选题",
        "multiple_choice": "多选题",
        "fill": "填空题",
        "judge": "判断题",
        "essay": "简答题",
        "calculation": "计算题",
        "comprehensive": "综合题",
        "composition": "作文题"
    }
    
    @staticmethod
    def get_template(grade_level: str, subject: Optional[str] = None) -> Dict[str, Any]:
        """
        根据学段和科目获取默认题型分布模板
        
        Args:
            grade_level: 学段（小学/初中/高中/大学）
            subject: 科目（可选，如：数学、语文、英语等）
        
        Returns:
            Dict: 包含题型分布和配置的字典
        """
        templates = {
            "小学": PaperTemplates._get_primary_template(subject),
            "初中": PaperTemplates._get_middle_template(subject),
            "高中": PaperTemplates._get_high_template(subject),
            "大学": PaperTemplates._get_university_template(subject)
        }
        
        return templates.get(grade_level, templates["高中"])
    
    @staticmethod
    def _get_primary_template(subject: Optional[str] = None) -> Dict[str, Any]:
        """小学模板"""
        if subject == "数学":
            return {
                "total_questions": 20,
                "question_type_distribution": {
                    "choice": 10,      # 50%
                    "fill": 5,          # 25%
                    "judge": 3,         # 15%
                    "calculation": 2    # 10%
                },
                "difficulty_distribution": {
                    "easy": 60,
                    "medium": 30,
                    "hard": 10
                },
                "time_limit": 60,
                "total_score": 100
            }
        else:
            # 通用小学模板
            return {
                "total_questions": 20,
                "question_type_distribution": {
                    "choice": 12,      # 60%
                    "fill": 5,          # 25%
                    "judge": 3          # 15%
                },
                "difficulty_distribution": {
                    "easy": 70,
                    "medium": 25,
                    "hard": 5
                },
                "time_limit": 60,
                "total_score": 100
            }
    
    @staticmethod
    def _get_middle_template(subject: Optional[str] = None) -> Dict[str, Any]:
        """初中模板（参考中考）"""
        if subject == "数学":
            return {
                "total_questions": 23,
                "question_type_distribution": {
                    "choice": 10,       # 43% (20-30%)
                    "fill": 5,           # 22% (10-15%)
                    "essay": 8           # 35% (55-60%)
                },
                "difficulty_distribution": {
                    "easy": 30,
                    "medium": 50,
                    "hard": 20
                },
                "time_limit": 120,
                "total_score": 150
            }
        elif subject == "语文":
            return {
                "total_questions": 25,
                "question_type_distribution": {
                    "choice": 8,         # 32%
                    "fill": 6,          # 24%
                    "essay": 11         # 44%
                },
                "difficulty_distribution": {
                    "easy": 25,
                    "medium": 55,
                    "hard": 20
                },
                "time_limit": 150,
                "total_score": 150
            }
        elif subject == "英语":
            return {
                "total_questions": 30,
                "question_type_distribution": {
                    "choice": 15,       # 50%
                    "fill": 8,          # 27%
                    "essay": 7          # 23%
                },
                "difficulty_distribution": {
                    "easy": 30,
                    "medium": 50,
                    "hard": 20
                },
                "time_limit": 120,
                "total_score": 150
            }
        else:
            # 通用初中模板
            return {
                "total_questions": 25,
                "question_type_distribution": {
                    "choice": 12,       # 48%
                    "fill": 6,          # 24%
                    "essay": 7          # 28%
                },
                "difficulty_distribution": {
                    "easy": 30,
                    "medium": 50,
                    "hard": 20
                },
                "time_limit": 120,
                "total_score": 150
            }
    
    @staticmethod
    def _get_high_template(subject: Optional[str] = None) -> Dict[str, Any]:
        """高中模板（参考高考）"""
        if subject == "数学":
            return {
                "total_questions": 19,
                "question_type_distribution": {
                    "choice": 8,            # 42% (单选题)
                    "multiple_choice": 3,   # 16% (多选题)
                    "fill": 3,              # 16% (填空题)
                    "essay": 5              # 26% (解答题)
                },
                "difficulty_distribution": {
                    "easy": 20,
                    "medium": 50,
                    "hard": 30
                },
                "time_limit": 120,
                "total_score": 150
            }
        elif subject == "语文":
            return {
                "total_questions": 22,
                "question_type_distribution": {
                    "choice": 10,       # 45%
                    "fill": 5,          # 23%
                    "essay": 7         # 32%
                },
                "difficulty_distribution": {
                    "easy": 20,
                    "medium": 55,
                    "hard": 25
                },
                "time_limit": 150,
                "total_score": 150
            }
        elif subject == "英语":
            return {
                "total_questions": 30,
                "question_type_distribution": {
                    "choice": 20,      # 67%
                    "fill": 5,          # 17%
                    "essay": 5         # 16%
                },
                "difficulty_distribution": {
                    "easy": 25,
                    "medium": 50,
                    "hard": 25
                },
                "time_limit": 120,
                "total_score": 150
            }
        else:
            # 通用高中模板
            return {
                "total_questions": 25,
                "question_type_distribution": {
                    "choice": 12,      # 48%
                    "fill": 5,          # 20%
                    "essay": 8         # 32%
                },
                "difficulty_distribution": {
                    "easy": 20,
                    "medium": 55,
                    "hard": 25
                },
                "time_limit": 120,
                "total_score": 150
            }
    
    @staticmethod
    def _get_university_template(subject: Optional[str] = None) -> Dict[str, Any]:
        """大学模板"""
        if subject == "数学" or subject == "高等数学":
            return {
                "total_questions": 15,
                "question_type_distribution": {
                    "choice": 5,           # 33%
                    "fill": 3,             # 20%
                    "calculation": 5,       # 33%
                    "essay": 2             # 14%
                },
                "difficulty_distribution": {
                    "easy": 20,
                    "medium": 50,
                    "hard": 30
                },
                "time_limit": 120,
                "total_score": 100
            }
        elif subject == "英语":
            return {
                "total_questions": 30,
                "question_type_distribution": {
                    "choice": 20,      # 67%
                    "fill": 5,          # 17%
                    "essay": 5         # 16%
                },
                "difficulty_distribution": {
                    "easy": 30,
                    "medium": 50,
                    "hard": 20
                },
                "time_limit": 120,
                "total_score": 100
            }
        else:
            # 通用大学模板
            return {
                "total_questions": 20,
                "question_type_distribution": {
                    "choice": 10,      # 50%
                    "fill": 4,          # 20%
                    "essay": 6         # 30%
                },
                "difficulty_distribution": {
                    "easy": 25,
                    "medium": 50,
                    "hard": 25
                },
                "time_limit": 120,
                "total_score": 100
            }
    
    @staticmethod
    def get_type_name(type_key: str) -> str:
        """获取题型中文名称"""
        return PaperTemplates.TYPE_NAMES.get(type_key, type_key)
    
    @staticmethod
    def get_all_types() -> Dict[str, str]:
        """获取所有支持的题型"""
        return PaperTemplates.TYPE_NAMES.copy()

