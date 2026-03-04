"""
测试日志输出脚本
用于验证 sys.stdout.write 和 print 是否正常工作
"""
import sys

print("=" * 60)
print("测试1: 使用 print()")
print("=" * 60)

sys.stdout.write("=" * 60 + "\n")
sys.stdout.write("测试2: 使用 sys.stdout.write()\n")
sys.stdout.write("=" * 60 + "\n")
sys.stdout.flush()

print("测试3: print() with flush=True", flush=True)

sys.stdout.write("测试4: sys.stdout.write() with flush\n")
sys.stdout.flush()

print("\n所有测试完成！")

