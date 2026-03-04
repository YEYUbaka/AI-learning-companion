"""
测试日志文件写入
"""
from core.logger import logger, log_file, error_log_file

print(f"日志文件路径: {log_file}")
print(f"错误日志文件路径: {error_log_file}")

logger.info("这是一条INFO级别的测试日志")
logger.warning("这是一条WARNING级别的测试日志")
logger.error("这是一条ERROR级别的测试日志")

print("\n测试完成！请检查日志文件：")
print(f"  - {log_file}")
print(f"  - {error_log_file}")

