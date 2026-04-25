"""
智学伴 AI个性化学习平台 - 后端主程序
FastAPI 应用入口
"""
import sys
import io

# 修复 Windows GBK 编码问题
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, ai, files, plan, quiz, analytics, admin, learning_map, chat, agent, knowledge, question_bank
from routers import agent_stream
from core.logger import logger, log_file, error_log_file
from core.security_middleware import SecurityMiddleware

logger.info("=" * 60)
logger.info("后端服务启动")
logger.info("日志文件: %s", log_file)
logger.info("错误日志文件: %s", error_log_file)
logger.info("=" * 60)

# 创建 FastAPI 应用实例
app = FastAPI(
    title="智学伴 AI个性化学习平台",
    description="基于 FastAPI + MySQL + OpenAI SDK 的智能学习平台",
    version="2.0.0"
)

# 配置 CORS（允许跨域请求）- 必须在其他中间件之前
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应指定具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加安全中间件（在 CORS 之后）
app.add_middleware(SecurityMiddleware)


# 添加请求日志中间件
@app.middleware("http")
async def log_requests(request, call_next):
    """记录所有HTTP请求"""
    import time
    start_time = time.time()
    path = request.url.path
    method = request.method
    client = request.client.host if request.client else 'unknown'

    logger.info("[REQUEST] %s %s - 客户端: %s", method, path, client)

    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(
            "[RESPONSE] %s %s - 状态码: %d - 耗时: %.3fs",
            method, path, response.status_code, process_time
        )
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            "[ERROR] %s %s - 错误: %s - 耗时: %.3fs",
            method, path, str(e), process_time
        )
        raise


# 自动创建数据库表
@app.on_event("startup")
async def startup_event():
    """启动时创建数据库表并初始化"""
    try:
        # 导入所有模型，确保表被创建
        from models import users, quizzes, study_plans, prompt, model_config, learning_map, chat_sessions  # noqa: F401
        from models import quiz_paper, agent_session, knowledge, question_bank as question_bank_models  # noqa: F401
        logger.info("开始创建数据库表...")
        Base.metadata.create_all(bind=engine)
        logger.info("[OK] 数据库表创建成功")

        # 运行轻量级 schema 迁移，确保知识图谱历史表结构完整
        try:
            from services.schema_migration_service import SchemaMigrationService
            SchemaMigrationService.ensure_learning_map_history_schema()
        except Exception as migration_exc:  # pylint: disable=broad-except
            logger.error("自动迁移知识图谱 schema 失败: %s", migration_exc, exc_info=True)

        # 初始化模型注册表
        from database import SessionLocal
        from utils.model_registry import registry
        db = SessionLocal()
        try:
            registry.load_from_db(db)
            logger.info("[OK] 模型注册表加载成功")
        except Exception as e:
            logger.error("[FAIL] 模型注册表加载失败: %s", e)
        finally:
            db.close()

        # 根据 .env 推送 Prompt / 模型配置
        db = SessionLocal()
        try:
            from services.bootstrap_service import BootstrapService
            sync_result = BootstrapService.sync_from_env(db)
            logger.info("Prompt / 模型自动同步完成：%s", sync_result)
        finally:
            db.close()

        # 检查是否有管理员用户
        from repositories.user_repo import UserRepository
        db = SessionLocal()
        try:
            user_count = UserRepository.count(db)
            if user_count == 0:
                logger.info("[INFO] 系统中暂无用户，第一个注册的用户将自动成为管理员")
        finally:
            db.close()

    except Exception as e:
        logger.error("[FAIL] 数据库表创建失败: %s", e)
        logger.warning("[INFO] 请确保 MySQL 已启动并正确配置 DATABASE_URL")

    # ChromaDB 初始化独立于数据库，始终尝试（即使 MySQL 不可用）
    try:
        from services.rag_service import RAGService
        collection = RAGService.get_collection()
        if collection is not None:
            logger.info("[OK] ChromaDB RAG 服务初始化成功")
        else:
            logger.warning("[WARN] ChromaDB 不可用，RAG 功能已禁用（请安装 requirements-rag.txt 中的依赖）")
    except Exception as rag_exc:
        logger.warning("[WARN] RAG 服务初始化失败（非致命）: %s", rag_exc)


# 注册路由
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(files.router)
app.include_router(plan.router)
app.include_router(quiz.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(learning_map.router)
app.include_router(chat.router)
app.include_router(agent.router)
app.include_router(agent_stream.router)  # Agent 流式输出路由
app.include_router(knowledge.router)     # 知识库路由

# 静态文件服务（知识库图片访问）
import os
from fastapi.staticfiles import StaticFiles
app.include_router(question_bank.router)
_kb_images_dir = os.path.abspath("knowledge_base/images")
os.makedirs(_kb_images_dir, exist_ok=True)
app.mount("/knowledge_images", StaticFiles(directory=_kb_images_dir), name="knowledge_images")
_uploads_dir = os.path.abspath("uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


# 根路由
@app.get("/")
async def root():
    return {
        "message": "欢迎使用智学伴 AI个性化学习平台！",
        "version": "2.0.0",
        "docs": "/docs",
    }


# 测试端点
@app.get("/test")
async def test_endpoint():
    """测试端点，验证请求是否到达后端"""
    return {"status": "ok", "message": "后端正常工作"}


# 健康检查接口
@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "message": "服务运行正常"}


# 运行程序
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
