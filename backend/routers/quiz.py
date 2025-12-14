"""
测评路由
处理AI出题、答题提交和批改、智能组卷、试卷导出
"""
from fastapi import APIRouter, HTTPException, status, Depends, Body, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from database import get_db
from models.quizzes import Quiz
from utils.quiz_generator import generate_quiz, evaluate_quiz
from services.quiz_paper_service import QuizPaperService
from utils.paper_exporter import PaperExporter
from core.logger import logger
from datetime import datetime
import json
import os
import tempfile

router = APIRouter(prefix="/api/v1/quiz", tags=["AI测评"])


class GenerateQuizRequest(BaseModel):
    """生成测验请求"""
    topic: str
    num_questions: Optional[int] = 5
    question_type_distribution: Optional[Dict[str, int]] = None  # 题型分布，如 {"choice": 3, "fill": 2}
    provider: Optional[str] = None


class SubmitQuizRequest(BaseModel):
    """提交测验请求"""
    user_id: int
    topic: Optional[str] = None
    questions: List[Dict]
    answers: List[str]
    provider: Optional[str] = None


class QuizResponse(BaseModel):
    """测验响应"""
    id: int
    user_id: int
    topic: Optional[str] = None
    score: int
    created_at: str


@router.post("/generate")
async def quiz_generate(
    request: GenerateQuizRequest,
    db: Session = Depends(get_db)
):
    """
    生成AI测验题目
    
    Args:
        request: 生成测验请求
        db: 数据库会话
        
    Returns:
        dict: 包含主题和题目列表
    """
    try:
        questions = generate_quiz(
            topic=request.topic,
            num_questions=request.num_questions or 5,
            question_type_distribution=request.question_type_distribution,
            provider=request.provider,
            db=db
        )
        
        return {
            "success": True,
            "topic": request.topic,
            "questions": questions,
            "message": "测验题目生成成功"
        }
        
    except ValueError as e:
        logger.error(f"生成测验题目失败（参数错误）: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"生成测验题目失败（系统错误）: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成测验题目失败: {str(e)}"
        )


@router.post("/submit")
async def quiz_submit(
    request: SubmitQuizRequest,
    db: Session = Depends(get_db)
):
    """
    提交测验答案并获取批改结果
    
    Args:
        request: 提交测验请求
        db: 数据库会话
        
    Returns:
        dict: 包含得分和讲解
    """
    try:
        # 验证输入
        if len(request.questions) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="题目列表不能为空"
            )
        
        if len(request.answers) != len(request.questions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="答案数量与题目数量不匹配"
            )
        
        # 调用AI批改
        result = evaluate_quiz(
            questions=request.questions,
            user_answers=request.answers,
            provider=request.provider
        )
        
        # 保存到数据库
        quiz = Quiz(
            user_id=request.user_id,
            topic=request.topic,
            questions=json.dumps(request.questions, ensure_ascii=False),
            answers=json.dumps(request.answers, ensure_ascii=False),
            score=result.get("score", 0),
            explanations=json.dumps(result.get("explanations", []), ensure_ascii=False)
        )
        
        db.add(quiz)
        db.commit()
        db.refresh(quiz)
        
        # 返回结果
        return {
            "success": True,
            "score": result.get("score", 0),
            "explanations": result.get("explanations", []),
            "quiz_id": quiz.id,
            "message": "测验提交成功"
        }
        
    except HTTPException:
        raise
    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"提交测验失败: {str(e)}"
        )


@router.get("/history/{user_id}")
async def get_quiz_history(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取用户的测评历史记录
    
    Args:
        user_id: 用户ID
        db: 数据库会话
        
    Returns:
        List[QuizResponse]: 测评记录列表
    """
    try:
        quizzes = db.query(Quiz).filter(Quiz.user_id == user_id).order_by(Quiz.created_at.desc()).all()
        
        result = []
        for quiz in quizzes:
            result.append(QuizResponse(
                id=quiz.id,
                user_id=quiz.user_id,
                topic=quiz.topic,
                score=quiz.score,
                created_at=quiz.created_at.isoformat() if quiz.created_at else ""
            ))
        
        return {
            "success": True,
            "quizzes": result,
            "count": len(result)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取测评历史失败: {str(e)}"
        )


@router.get("/{quiz_id}")
async def get_quiz_detail(
    quiz_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定测评的详细信息
    
    Args:
        quiz_id: 测评ID
        db: 数据库会话
        
    Returns:
        dict: 测评详细信息
    """
    try:
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
        
        if not quiz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="测评记录不存在"
            )
        
        return {
            "success": True,
            "quiz": {
                "id": quiz.id,
                "user_id": quiz.user_id,
                "topic": quiz.topic,
                "questions": json.loads(quiz.questions),
                "answers": json.loads(quiz.answers),
                "score": quiz.score,
                "explanations": json.loads(quiz.explanations),
                "created_at": quiz.created_at.isoformat() if quiz.created_at else ""
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取测评详情失败: {str(e)}"
        )


# ========== 智能组卷相关API ==========

class PaperGenerateRequest(BaseModel):
    """生成试卷请求"""
    title: str
    subject: Optional[str] = None
    grade_level: Optional[str] = None
    total_questions: int = 20
    difficulty_distribution: Optional[Dict[str, int]] = None
    question_type_distribution: Optional[Dict[str, int]] = None
    knowledge_points: Optional[List[str]] = None
    time_limit: Optional[int] = None
    total_score: int = 100
    user_id: int  # 将user_id包含在请求模型中


@router.post("/paper/generate")
async def generate_paper(
    request: PaperGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    生成自定义试卷
    
    Args:
        request: 组卷配置
        user_id: 用户ID
        db: 数据库会话
        
    Returns:
        dict: 包含试卷ID和题目列表
    """
    try:
        config = {
            "title": request.title,
            "subject": request.subject,
            "grade_level": request.grade_level,
            "total_questions": request.total_questions,
            "difficulty_distribution": request.difficulty_distribution or {"easy": 30, "medium": 50, "hard": 20},
            "question_type_distribution": request.question_type_distribution or {"choice": 15, "fill": 5},
            "knowledge_points": request.knowledge_points,
            "time_limit": request.time_limit,
            "total_score": request.total_score
        }
        
        result = QuizPaperService.generate_custom_paper(db, request.user_id, config)
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成试卷失败: {str(e)}"
        )


@router.get("/paper/{paper_id}")
async def get_paper(
    paper_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """获取试卷详情"""
    try:
        paper = QuizPaperService.get_paper(db, paper_id, user_id)
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="试卷不存在"
            )
        return {"success": True, "paper": paper}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取试卷失败: {str(e)}"
        )


@router.get("/paper/list/{user_id}")
async def list_papers(
    user_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """获取用户的试卷列表"""
    try:
        papers = QuizPaperService.list_papers(db, user_id, skip, limit)
        return {"success": True, "papers": papers, "count": len(papers)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取试卷列表失败: {str(e)}"
        )


@router.delete("/paper/{paper_id}")
async def delete_paper(
    paper_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """删除试卷"""
    try:
        success = QuizPaperService.delete_paper(db, paper_id, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="试卷不存在"
            )
        return {"success": True, "message": "试卷已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除试卷失败: {str(e)}"
        )


@router.get("/paper/{paper_id}/export")
async def export_paper(
    paper_id: int,
    user_id: int = Query(...),
    format: str = Query("pdf", regex="^(pdf|word)$"),
    include_answer: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    导出试卷
    
    Args:
        paper_id: 试卷ID
        user_id: 用户ID
        format: 导出格式（pdf/word）
        include_answer: 是否包含答案
        db: 数据库会话
        
    Returns:
        FileResponse: 导出的文件
    """
    try:
        # 获取试卷数据
        paper = QuizPaperService.get_paper(db, paper_id, user_id)
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="试卷不存在"
            )
        
        # 准备导出数据
        export_data = {
            "title": paper["title"],
            "subject": paper.get("subject"),
            "grade_level": paper.get("grade_level"),
            "total_questions": paper["total_questions"],
            "time_limit": paper.get("time_limit"),
            "questions": paper["questions"]
        }
        
        if include_answer:
            export_data["answer_key"] = paper.get("answer_key")
        
        # 创建临时文件
        temp_dir = tempfile.gettempdir()
        file_ext = "pdf" if format == "pdf" else "docx"
        filename = f"试卷_{paper_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_ext}"
        output_path = os.path.join(temp_dir, filename)
        
        # 导出文件
        if format == "pdf":
            PaperExporter.export_to_pdf(export_data, output_path)
        else:
            PaperExporter.export_to_word(export_data, output_path)
        
        # 返回文件
        media_type = "application/pdf" if format == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        headers = {
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Cache-Control": "no-store"
        }
        resp = FileResponse(
            output_path,
            filename=filename,
            media_type=media_type
        )
        for k, v in headers.items():
            resp.headers[k] = v
        return resp
        
    except HTTPException:
        raise
    except ValueError as e:
        # 如果是依赖库未安装的错误，返回更友好的错误信息
        error_msg = str(e)
        if "需要安装" in error_msg or "pip install" in error_msg:
            logger.warning(f"导出失败（依赖库未安装）: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=error_msg
            )
        else:
            logger.error(f"导出失败（参数错误）: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
    except Exception as e:
        logger.error(f"导出试卷失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出试卷失败: {str(e)}"
        )


# ========== 试卷模板相关API ==========

class TemplateCreateRequest(BaseModel):
    """创建模板请求"""
    name: str
    description: Optional[str] = None
    paper_title: Optional[str] = None
    subject: Optional[str] = None
    grade_level: Optional[str] = None
    total_questions: int = 20
    difficulty_distribution: Optional[Dict[str, int]] = None
    question_type_distribution: Optional[Dict[str, int]] = None
    knowledge_points: Optional[List[str]] = None
    time_limit: Optional[int] = None
    total_score: int = 100
    user_id: int  # 将user_id包含在请求模型中


@router.post("/template/create")
async def create_template(
    request: TemplateCreateRequest,
    db: Session = Depends(get_db)
):
    """创建试卷模板"""
    try:
        template_data = {
            "name": request.name,
            "description": request.description,
            "paper_title": request.paper_title,
            "subject": request.subject,
            "grade_level": request.grade_level,
            "total_questions": request.total_questions,
            "difficulty_distribution": request.difficulty_distribution,
            "question_type_distribution": request.question_type_distribution,
            "knowledge_points": request.knowledge_points,
            "time_limit": request.time_limit,
            "total_score": request.total_score
        }
        
        result = QuizPaperService.save_template(db, request.user_id, template_data)
        return {"success": True, "template": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建模板失败: {str(e)}"
        )


@router.get("/template/list/{user_id}")
async def list_templates(
    user_id: int,
    db: Session = Depends(get_db)
):
    """获取用户的模板列表"""
    try:
        templates = QuizPaperService.list_templates(db, user_id)
        return {"success": True, "templates": templates, "count": len(templates)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板列表失败: {str(e)}"
        )


@router.delete("/template/{template_id}")
async def delete_template(
    template_id: int,
    user_id: int = Query(..., description="用户ID"),
    db: Session = Depends(get_db)
):
    """删除模板"""
    try:
        result = QuizPaperService.delete_template(db, template_id, user_id)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"删除模板失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除模板失败: {str(e)}"
        )


@router.get("/template/default")
async def get_default_template(
    grade_level: str = Query(..., description="学段：小学/初中/高中/大学"),
    subject: Optional[str] = Query(None, description="科目（可选）")
):
    """获取默认题型分布模板"""
    try:
        from utils.paper_templates import PaperTemplates
        template = PaperTemplates.get_template(grade_level, subject)
        return {
            "success": True,
            "template": template,
            "grade_level": grade_level,
            "subject": subject
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板失败: {str(e)}"
        )


@router.get("/template/recommend")
async def get_recommended_template(
    grade_level: str = Query(..., description="学段：小学/初中/高中/大学"),
    subject: Optional[str] = Query(None, description="科目（可选）"),
    total_questions: Optional[int] = Query(None, description="总题数（可选，AI可推荐）"),
    provider: Optional[str] = Query(None, description="AI提供商（可选）"),
    time_limit: Optional[int] = Query(None, description="考试时长（分钟，可选，AI可推荐）"),
    title: Optional[str] = Query(None, description="试卷标题（可选，用于AI推荐）"),
    db: Session = Depends(get_db)
):
    """使用AI搜索并获取推荐的模板参数"""
    try:
        from services.template_recommendation_service import TemplateRecommendationService
        
        recommendation = TemplateRecommendationService.get_recommended_template(
            db=db,
            grade_level=grade_level,
            subject=subject,
            total_questions=total_questions,
            provider=provider,
            time_limit=time_limit,
            title=title
        )
        
        return {
            "success": True,
            "recommendation": recommendation,
            "message": "获取AI推荐成功"
        }
    except Exception as e:
        logger.error(f"获取AI推荐失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取AI推荐失败: {str(e)}"
        )

