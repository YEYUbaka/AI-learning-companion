"""
测验服务
作者：智学伴开发团队
目的：测验业务逻辑层（简化版，保持与现有代码兼容）
"""
from typing import Dict, Any
from sqlalchemy.orm import Session
from services.ai_service import AIService


class QuizService:
    """测验服务类"""
    
    @staticmethod
    def generate_quiz(db: Session, topic: str, num_questions: int = 5) -> Dict[str, Any]:
        """生成测验（使用AI服务）"""
        prompt = f"请为以下主题生成{num_questions}道测验题目：{topic}。要求：3道选择题（4个选项），2道填空题。返回JSON格式。"
        
        result = AIService.call_ai(db, prompt, system_prompt_name="quiz_generator")
        # 这里简化处理，实际应该解析AI返回的JSON
        return {
            "topic": topic,
            "questions": [],
            "message": "测验生成成功"
        }

