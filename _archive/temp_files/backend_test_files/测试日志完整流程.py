"""
测试日志完整流程
模拟服务启动和请求处理
"""
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入logger（模拟main.py的导入）
from core.logger import logger, log_file, error_log_file

print("="*60)
print("测试日志系统")
print("="*60)
print(f"日志文件: {log_file}")
print(f"错误日志文件: {error_log_file}")
print(f"Logger handlers数量: {len(logger.handlers)}")
for i, handler in enumerate(logger.handlers):
    print(f"  Handler {i+1}: {type(handler).__name__} - Level: {handler.level}")
print("="*60)

# 测试写入日志
logger.info("="*60)
logger.info("测试：后端服务启动")
logger.info(f"测试：日志文件: {log_file}")
logger.info(f"测试：错误日志文件: {error_log_file}")
logger.info("="*60)
logger.info("测试：开始创建数据库表...")
logger.info("测试：✅ 数据库表创建成功")
logger.info("测试：✅ 模型注册表加载成功")
logger.warning("测试：这是一条警告日志")
logger.error("测试：这是一条错误日志")

print("\n✅ 日志写入完成！")
print(f"请检查日志文件: {log_file}")
print(f"请检查错误日志文件: {error_log_file}")

