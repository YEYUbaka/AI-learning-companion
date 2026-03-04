"""
修复 Windows GBK 编码问题
设置 Python 输出编码为 UTF-8
"""
import sys
import io

# 强制设置标准输出和标准错误为 UTF-8 编码
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
