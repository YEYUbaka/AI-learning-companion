"""
测验相关Schemas
作者：智学伴开发团队
目的：定义测验相关的请求和响应模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class QuizGenerateRequest(BaseModel):
    """生成测验请求模型"""
    topic: str = Field(..., description="测验主题")
    num_questions: int = Field(5, ge=1, le=20, description="题目数量")


class QuizQuestion(BaseModel):
    """题目模型"""
    question: str
    type: str  # "choice" or "fill"
    options: Optional[List[str]] = None  # 选择题选项
    correct_answer: str


class QuizGenerateResponse(BaseModel):
    """生成测验响应模型"""
    quiz_id: int
    topic: str
    questions: List[QuizQuestion]
    message: str = "测验生成成功"


class QuizSubmitRequest(BaseModel):
    """提交答案请求模型"""
    quiz_id: int
    answers: Dict[int, str] = Field(..., description="答案字典，key为题目序号，value为答案")


class QuizResult(BaseModel):
    """测验结果模型"""
    quiz_id: int
    score: int
    total: int
    correct_count: int
    wrong_count: int
    details: List[Dict[str, Any]]

