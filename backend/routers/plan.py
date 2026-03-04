"""
学习计划路由
处理学习计划的生成和管理
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from database import get_db
from models.study_plans import StudyPlan
from utils.plan_generator import generate_study_plan
import json

router = APIRouter(prefix="/api/v1/ai/plan", tags=["学习计划"])


class GeneratePlanRequest(BaseModel):
    """生成学习计划请求"""
    user_id: int
    goals: Optional[str] = ""  # 学习目标改为可选
    file_text: Optional[str] = None
    file_name: Optional[str] = None
    provider: Optional[str] = None


class PlanResponse(BaseModel):
    """学习计划响应"""
    id: int
    user_id: int
    goal: str
    plan: List[Dict]
    file_name: Optional[str] = None
    created_at: str


@router.post("/generate")
async def generate_plan(
    request: GeneratePlanRequest,
    db: Session = Depends(get_db)
):
    """
    生成学习计划
    
    Args:
        request: 生成计划请求
        db: 数据库会话
        
    Returns:
        PlanResponse: 生成的学习计划
    """
    try:
        # 调用AI生成学习计划
        plan_data = generate_study_plan(
            user_id=request.user_id,
            goals=request.goals,
            file_text=request.file_text,
            provider=request.provider
        )
        
        # 将计划转换为JSON字符串存储
        plan_json = json.dumps(plan_data, ensure_ascii=False)
        
        # 保存到数据库（如果goals为空，使用默认值）
        goal_text = request.goals.strip() if request.goals else "根据教材内容生成学习计划"
        
        study_plan = StudyPlan(
            user_id=request.user_id,
            goal=goal_text,
            plan_json=plan_json,
            file_name=request.file_name
        )
        
        db.add(study_plan)
        db.commit()
        db.refresh(study_plan)
        
        # 返回结果
        return PlanResponse(
            id=study_plan.id,
            user_id=study_plan.user_id,
            goal=study_plan.goal,
            plan=plan_data,
            file_name=study_plan.file_name,
            created_at=study_plan.created_at.isoformat() if study_plan.created_at else ""
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成学习计划失败: {str(e)}"
        )


@router.get("/list/{user_id}")
async def get_user_plans(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取用户的所有学习计划
    
    Args:
        user_id: 用户ID
        db: 数据库会话
        
    Returns:
        List[PlanResponse]: 学习计划列表
    """
    try:
        plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).order_by(StudyPlan.created_at.desc()).all()
        
        result = []
        for plan in plans:
            plan_data = json.loads(plan.plan_json)
            result.append(PlanResponse(
                id=plan.id,
                user_id=plan.user_id,
                goal=plan.goal,
                plan=plan_data,
                file_name=plan.file_name,
                created_at=plan.created_at.isoformat() if plan.created_at else ""
            ))
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取学习计划失败: {str(e)}"
        )


@router.get("/{plan_id}")
async def get_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定学习计划
    
    Args:
        plan_id: 计划ID
        db: 数据库会话
        
    Returns:
        PlanResponse: 学习计划
    """
    try:
        plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
        
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="学习计划不存在"
            )
        
        plan_data = json.loads(plan.plan_json)
        
        return PlanResponse(
            id=plan.id,
            user_id=plan.user_id,
            goal=plan.goal,
            plan=plan_data,
            file_name=plan.file_name,
            created_at=plan.created_at.isoformat() if plan.created_at else ""
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取学习计划失败: {str(e)}"
        )


@router.delete("/{plan_id}")
async def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    删除学习计划
    
    Args:
        plan_id: 计划ID
        db: 数据库会话
        
    Returns:
        dict: 删除结果
    """
    try:
        plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
        
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="学习计划不存在"
            )
        
        db.delete(plan)
        db.commit()
        
        return {"success": True, "message": "学习计划已删除"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除学习计划失败: {str(e)}"
        )

