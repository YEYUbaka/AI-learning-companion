"""
学习地图 Pydantic 模型
作者：智学伴开发团队
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class LearningMapUploadResponse(BaseModel):
    file_id: int
    file_name: str
    text_preview: str
    message: str = "文件上传成功"


class LearningMapGenerateRequest(BaseModel):
    user_id: int
    file_id: Optional[int] = None
    course_topic: Optional[str] = None
    provider: Optional[str] = None

    @model_validator(mode="after")
    def validate_input(cls, values):
        if not values.file_id and not values.course_topic:
            raise ValueError("必须提供file_id或course_topic之一")
        return values


class LearningNodeSchema(BaseModel):
    id: int
    title: str
    description: Optional[str]
    level: Optional[str]
    mastery: Optional[str]
    example: Optional[str]
    resources: Optional[List[str]]

    class Config:
        orm_mode = True


class LearningEdgeSchema(BaseModel):
    id: int
    from_node_id: int
    to_node_id: int
    relation: str

    class Config:
        orm_mode = True


class LearningGraphResponse(BaseModel):
    nodes: List[LearningNodeSchema]
    edges: List[LearningEdgeSchema]
    session: Optional["LearningMapSessionSchema"]


class LearningMapGenerateResponse(BaseModel):
    success: bool
    node_count: int
    edge_count: int
    session_id: int
    message: str = "知识图谱生成完成"


class LearningMapSessionSchema(BaseModel):
    id: int
    topic: Optional[str]
    provider: Optional[str]
    file_id: Optional[int]
    source_preview: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LearningMapHistoryResponse(BaseModel):
    sessions: List[LearningMapSessionSchema]


LearningGraphResponse.model_rebuild()

