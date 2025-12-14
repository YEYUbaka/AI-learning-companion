"""
智学伴 AI个性化学习平台 - 后端主程序
FastAPI 应用入口
"""
import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, ai, files, plan, quiz, analytics, admin, learning_map, chat
from core.logger import logger, log_file, error_log_file
from core.security_middleware import SecurityMiddleware

# 配置日志系统
# 注意：core.logger 已经在导入时配置好了，直接使用即可
# 确保根logger也使用相同的配置（这样所有子logger都会继承文件输出）
root_logger = logging.getLogger()
# 不设置propagate=False，让子logger的日志传播到根logger
# 这样core.logger.logger的日志会同时写入自己的handlers和根logger的handlers

# 启动时写入测试日志（使用core.logger.logger，它已经有文件handler）
logger.info("="*60)
logger.info("后端服务启动")
logger.info(f"日志文件: {log_file}")
logger.info(f"错误日志文件: {error_log_file}")
logger.info(f"Logger handlers数量: {len(logger.handlers)}")
for i, handler in enumerate(logger.handlers):
    logger.info(f"Handler {i+1}: {type(handler).__name__} - Level: {handler.level}")
logger.info("="*60)
sys.stdout.write(f"\n[启动] 日志文件路径: {log_file}\n")
sys.stdout.write(f"[启动] 错误日志文件路径: {error_log_file}\n")
sys.stdout.write(f"[启动] Logger handlers数量: {len(logger.handlers)}\n")
sys.stdout.flush()

# 创建 FastAPI 应用实例
app = FastAPI(
    title="智学伴 AI个性化学习平台",
    description="基于 FastAPI + SQLite + OpenAI SDK 的智能学习平台",
    version="1.0.0"
)

# 添加安全中间件（必须在 CORS 之前）
app.add_middleware(SecurityMiddleware)

# 配置 CORS（允许跨域请求）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应指定具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加请求日志中间件
@app.middleware("http")
async def log_requests(request, call_next):
    """记录所有HTTP请求"""
    import time
    import sys
    
    # 使用项目logger（包含文件输出）
    # 注意：在函数内部导入，确保logger已经初始化
    from core.logger import logger as app_logger, log_file
    
    start_time = time.time()
    path = request.url.path
    method = request.method
    client = request.client.host if request.client else 'unknown'
    
    # 多种方式输出，确保能看到
    try:
        # 方式1: sys.stdout.write（控制台输出）
        sys.stdout.write(f"\n{'='*60}\n")
        sys.stdout.write(f"[REQUEST] {method} {path}\n")
        sys.stdout.write(f"[REQUEST] 客户端: {client}\n")
        sys.stdout.write(f"{'='*60}\n\n")
        sys.stdout.flush()
        
        # 方式2: print with flush（备用控制台输出）
        print(f"[REQUEST-PRINT] {method} {path} - 客户端: {client}", flush=True)
        
        # 方式3: logger（写入文件和控制台）
        # 确保logger有handlers
        if app_logger.handlers:
            app_logger.info(f"[REQUEST-LOG] {method} {path} - 客户端: {client}")
        else:
            # 如果logger没有handlers，直接写入文件
            import logging
            root_logger = logging.getLogger()
            if root_logger.handlers:
                root_logger.info(f"[REQUEST-LOG] {method} {path} - 客户端: {client}")
        
        # 方式4: 直接写入文件（备用方案）
        try:
            from datetime import datetime
            log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - zhixueban - INFO - [REQUEST-LOG] {method} {path} - 客户端: {client}\n"
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry)
                f.flush()
        except Exception as direct_write_err:
            sys.stdout.write(f"[WARNING] 直接写入日志文件失败: {direct_write_err}\n")
            sys.stdout.flush()
    except Exception as e:
        # 如果输出失败，至少记录错误
        try:
            app_logger.error(f"日志输出失败: {e}")
        except:
            pass
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # 控制台输出
        sys.stdout.write(f"[RESPONSE] {method} {path} - 状态码: {response.status_code} - 耗时: {process_time:.3f}s\n")
        sys.stdout.flush()
        print(f"[RESPONSE-PRINT] {method} {path} - 状态码: {response.status_code} - 耗时: {process_time:.3f}s", flush=True)
        
        # 文件日志
        if app_logger.handlers:
            app_logger.info(f"[RESPONSE-LOG] {method} {path} - 状态码: {response.status_code} - 耗时: {process_time:.3f}s")
        else:
            import logging
            root_logger = logging.getLogger()
            if root_logger.handlers:
                root_logger.info(f"[RESPONSE-LOG] {method} {path} - 状态码: {response.status_code} - 耗时: {process_time:.3f}s")
        
        # 直接写入文件（备用方案）
        try:
            from datetime import datetime
            log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - zhixueban - INFO - [RESPONSE-LOG] {method} {path} - 状态码: {response.status_code} - 耗时: {process_time:.3f}s\n"
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry)
                f.flush()
        except Exception as direct_write_err:
            pass
        
        return response
    except Exception as e:
        process_time = time.time() - start_time
        error_msg = f"[ERROR] {method} {path} - 错误: {str(e)} - 耗时: {process_time:.3f}s"
        
        # 控制台输出
        sys.stdout.write(error_msg + "\n")
        sys.stdout.flush()
        print(error_msg, flush=True)
        
        # 文件日志
        try:
            if app_logger.handlers:
                app_logger.error(error_msg)
            else:
                import logging
                root_logger = logging.getLogger()
                if root_logger.handlers:
                    root_logger.error(error_msg)
        except:
            pass
        
        raise

# 自动创建数据库表
@app.on_event("startup")
async def startup_event():
    """启动时创建数据库表并初始化"""
    try:
        # 导入所有模型，确保表被创建
        from models import users, quizzes, study_plans, prompt, model_config, learning_map, chat_sessions  # noqa: F401
        from models import quiz_paper  # noqa: F401
        logger.info("开始创建数据库表...")
        Base.metadata.create_all(bind=engine)
        print("✅ 数据库表创建成功")
        logger.info("✅ 数据库表创建成功")

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
            print("✅ 模型注册表加载成功")
            logger.info("✅ 模型注册表加载成功")
        except Exception as e:
            print(f"⚠️  模型注册表加载失败: {e}")
            logger.error(f"⚠️  模型注册表加载失败: {e}")
        finally:
            db.close()
        
        # 根据 .env 推送 Prompt / 模型配置
        db = SessionLocal()
        try:
            from services.bootstrap_service import BootstrapService
            sync_result = BootstrapService.sync_from_env(db)
            logger.info(
                "Prompt / 模型自动同步完成：%s",
                sync_result,
            )
        finally:
            db.close()
        
        # 检查是否有管理员用户
        from database import SessionLocal
        from repositories.user_repo import UserRepository
        db = SessionLocal()
        try:
            user_count = UserRepository.count(db)
            if user_count == 0:
                print("ℹ️  提示：系统中暂无用户，第一个注册的用户将自动成为管理员")
        finally:
            db.close()
            
    except Exception as e:
        print(f"⚠️  数据库表创建失败: {e}")
        print("⚠️  提示：用户注册功能将不可用，但 AI 问答功能仍可正常使用")
        print("⚠️  请确保 SQL Server 已启动，或跳过数据库功能测试 AI 功能")


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


# 根路由
@app.get("/")
async def root():
    """
    欢迎页面
    
    返回基本信息
    """
    import sys
    sys.stdout.write("[TEST] 根路由被访问\n")
    sys.stdout.flush()
    return {
        "message": "欢迎使用智学伴 AI个性化学习平台！",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "注册": "POST /api/v1/auth/register",
            "AI问答": "POST /api/v1/ai/ask"
        }
    }

# 测试端点 - 验证请求是否到达
@app.get("/test")
async def test_endpoint():
    """测试端点，验证请求是否到达后端"""
    import sys
    sys.stdout.write("\n" + "="*60 + "\n")
    sys.stdout.write("[TEST] 测试端点被访问\n")
    sys.stdout.write("="*60 + "\n\n")
    sys.stdout.flush()
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
