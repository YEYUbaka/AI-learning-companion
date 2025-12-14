"""
日志模块
作者：智学伴开发团队
目的：统一日志配置和管理
环境变量：LOG_DIR, LOG_LEVEL
测试：直接运行查看日志输出
"""
import logging
import sys
import os
from pathlib import Path
from datetime import datetime
from core.config import settings

# 确保日志目录存在
log_dir = Path(settings.LOG_DIR)
log_dir.mkdir(exist_ok=True)

# 日志文件路径
log_file = log_dir / f"app_{datetime.now().strftime('%Y%m%d')}.log"
error_log_file = log_dir / f"error_{datetime.now().strftime('%Y%m%d')}.log"


def setup_logger(name: str = "zhixueban") -> logging.Logger:
    """设置日志记录器"""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    
    # 避免重复添加handler
    if logger.handlers:
        return logger
    
    # 日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 文件输出（所有日志）
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    # 确保立即刷新到文件
    file_handler.stream.reconfigure(line_buffering=True) if hasattr(file_handler.stream, 'reconfigure') else None
    logger.addHandler(file_handler)
    
    # 错误日志单独文件
    error_handler = logging.FileHandler(error_log_file, encoding='utf-8')
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    # 确保立即刷新到文件
    error_handler.stream.reconfigure(line_buffering=True) if hasattr(error_handler.stream, 'reconfigure') else None
    logger.addHandler(error_handler)
    
    return logger


# 全局日志实例
logger = setup_logger()

