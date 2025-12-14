"""
生成安全密钥工具
作者：智学伴开发团队
目的：生成SECRET_KEY和ENCRYPTION_KEY
使用方法：python generate_keys.py
"""
import secrets
import base64
import hashlib


def generate_secret_key(length=32):
    """生成随机密钥（用于JWT）"""
    return secrets.token_urlsafe(length)


def generate_encryption_key():
    """
    生成Fernet加密密钥（用于API密钥加密）
    Fernet密钥是32字节的base64编码字符串
    """
    # 生成32字节的随机密钥
    key_bytes = secrets.token_bytes(32)
    # 转换为base64编码（Fernet格式）
    return base64.urlsafe_b64encode(key_bytes).decode()


if __name__ == "__main__":
    print("=" * 60)
    print("智学伴密钥生成工具")
    print("=" * 60)
    print()
    
    secret_key = generate_secret_key(32)
    encryption_key = generate_encryption_key()
    
    print("✅ 已生成安全密钥，请复制到 .env 文件中：")
    print()
    print("SECRET_KEY=" + secret_key)
    print("ENCRYPTION_KEY=" + encryption_key)
    print()
    print("=" * 60)
    print("⚠️  重要提示：")
    print("1. 请妥善保管这些密钥，不要泄露")
    print("2. 生产环境必须使用强随机密钥")
    print("3. 如果密钥丢失，已加密的数据将无法解密")
    print("=" * 60)

