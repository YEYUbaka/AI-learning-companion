"""
数据分析与报告路由
处理学习进度统计和PDF报告生成
"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from models.quizzes import Quiz
from models.study_plans import StudyPlan
from utils.report_generator import generate_pdf_report
import os
import json
from typing import List, Dict

router = APIRouter(prefix="/api/v1/analytics", tags=["数据分析"])


@router.get("/progress/{user_id}")
async def get_progress(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取用户学习进度统计
    
    Args:
        user_id: 用户ID
        db: 数据库会话
        
    Returns:
        dict: 包含完成率、平均分、弱项等统计信息
    """
    try:
        # 获取测评数据
        quizzes = db.query(Quiz).filter(Quiz.user_id == user_id).order_by(Quiz.created_at.desc()).all()
        
        # 获取学习计划数据
        study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).all()
        
        # 如果没有数据，返回默认值
        if not quizzes and not study_plans:
            return {
                "completion_rate": 0,
                "average_score": 0,
                "total_tests": 0,
                "total_plans": 0,
                "weak_topics": [],
                "recent_scores": [],
                "score_trend": []
            }
        
        # 计算测评统计
        scores = [q.score for q in quizzes if q.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # 计算完成率（基于平均分）
        completion_rate = min(100, int(avg_score)) if scores else 0
        
        # 分析弱项（如果平均分低于80，标记为需要加强）
        weak_topics = []
        if avg_score < 80 and scores:
            # 分析错题较多的主题
            topic_scores = {}
            for quiz in quizzes:
                if quiz.topic:
                    if quiz.topic not in topic_scores:
                        topic_scores[quiz.topic] = []
                    topic_scores[quiz.topic].append(quiz.score)
            
            # 找出平均分较低的主题
            for topic, topic_score_list in topic_scores.items():
                topic_avg = sum(topic_score_list) / len(topic_score_list)
                if topic_avg < 70:
                    weak_topics.append(topic)
        
        # 如果没有明确的弱项，但平均分较低，给出通用建议
        if not weak_topics and avg_score < 80:
            weak_topics = ["基础知识", "综合应用"]
        
        # 最近5次得分（用于折线图）
        recent_scores = [q.score for q in quizzes[:5] if q.score is not None]
        recent_scores.reverse()  # 按时间正序
        
        # 得分趋势数据（用于图表）
        score_trend = []
        for i, quiz in enumerate(quizzes[:10][::-1]):  # 最近10次，按时间正序
            if quiz.score is not None:
                score_trend.append({
                    "index": i + 1,
                    "score": quiz.score,
                    "date": quiz.created_at.strftime('%m-%d') if quiz.created_at else ""
                })
        
        return {
            "completion_rate": completion_rate,
            "average_score": round(avg_score, 1),
            "total_tests": len(quizzes),
            "total_plans": len(study_plans),
            "weak_topics": weak_topics[:5],  # 最多返回5个弱项
            "recent_scores": recent_scores,
            "score_trend": score_trend,
            "max_score": max(scores) if scores else 0,
            "min_score": min(scores) if scores else 0
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取学习进度失败: {str(e)}"
        )


@router.get("/report/{user_id}")
async def download_report(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    生成并下载PDF学习报告
    
    Args:
        user_id: 用户ID
        db: 数据库会话
        
    Returns:
        FileResponse: PDF文件
    """
    import logging
    import sys
    logger = logging.getLogger(__name__)
    
    # 使用多种方式确保日志输出
    print("\n" + "="*80, flush=True)
    print(f"📄 [PDF报告] 开始生成PDF报告，用户ID: {user_id}", flush=True)
    print("="*80 + "\n", flush=True)
    logger.info(f"📄 开始生成PDF报告，用户ID: {user_id}")
    sys.stdout.flush()
    
    try:
        # 生成PDF报告
        print("🔄 [PDF报告] 调用generate_pdf_report函数...", flush=True)
        sys.stdout.flush()
        logger.info("🔄 调用generate_pdf_report函数...")
        report_path = generate_pdf_report(user_id)
        print(f"✅ [PDF报告] PDF报告生成成功: {report_path}", flush=True)
        sys.stdout.flush()
        logger.info(f"✅ PDF报告生成成功: {report_path}")
        
        if not os.path.exists(report_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PDF报告生成失败"
            )
        
        # 返回文件
        return FileResponse(
            path=report_path,
            filename=os.path.basename(report_path),
            media_type="application/pdf"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"下载报告失败: {str(e)}"
        )


@router.get("/stats/{user_id}")
async def get_detailed_stats(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取详细统计数据（用于图表展示）
    
    Args:
        user_id: 用户ID
        db: 数据库会话
        
    Returns:
        dict: 详细统计数据
    """
    try:
        quizzes = db.query(Quiz).filter(Quiz.user_id == user_id).order_by(Quiz.created_at.asc()).all()
        study_plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).all()
        
        # 按主题统计
        topic_stats = {}
        for quiz in quizzes:
            topic = quiz.topic or "未分类"
            if topic not in topic_stats:
                topic_stats[topic] = {"count": 0, "total_score": 0, "scores": []}
            topic_stats[topic]["count"] += 1
            topic_stats[topic]["total_score"] += quiz.score
            topic_stats[topic]["scores"].append(quiz.score)
        
        # 计算每个主题的平均分
        topic_averages = []
        for topic, stats in topic_stats.items():
            avg = stats["total_score"] / stats["count"] if stats["count"] > 0 else 0
            topic_averages.append({
                "topic": topic,
                "average_score": round(avg, 1),
                "count": stats["count"]
            })
        
        # 按月份统计
        monthly_stats = {}
        for quiz in quizzes:
            if quiz.created_at:
                month_key = quiz.created_at.strftime('%Y-%m')
                if month_key not in monthly_stats:
                    monthly_stats[month_key] = {"count": 0, "total_score": 0}
                monthly_stats[month_key]["count"] += 1
                monthly_stats[month_key]["total_score"] += quiz.score
        
        monthly_data = []
        for month, stats in sorted(monthly_stats.items()):
            avg = stats["total_score"] / stats["count"] if stats["count"] > 0 else 0
            monthly_data.append({
                "month": month,
                "average_score": round(avg, 1),
                "count": stats["count"]
            })
        
        return {
            "success": True,
            "topic_statistics": topic_averages,
            "monthly_statistics": monthly_data,
            "total_quizzes": len(quizzes),
            "total_plans": len(study_plans)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取统计数据失败: {str(e)}"
        )

