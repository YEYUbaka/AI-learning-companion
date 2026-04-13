"""
一次性重置当前数据库全部用户密码。

用法:
    python scripts/reset_all_user_passwords.py --password "StrongPass!9"

也可通过环境变量提供:
    BULK_RESET_DEFAULT_PASSWORD=StrongPass!9
"""
import argparse
import os

from core.logger import logger
from core.security import hash_password
from database import SessionLocal
from models.users import User
from utils.password_policy import is_strong_password


def validate_default_password(password: str) -> None:
    if not password or not is_strong_password(password):
        raise ValueError("统一默认密码必须是强密码")


def bulk_reset_passwords(db, new_password: str) -> dict:
    validate_default_password(new_password)

    users = db.query(User).all()
    for user in users:
        user.hashed_password = hash_password(new_password)
        user.token_version = (user.token_version or 0) + 1

    db.commit()

    logger.warning("[WARNING] 已完成全量用户密码重置: updated_users=%s", len(users))
    return {"updated_users": len(users)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="重置当前数据库全部用户密码")
    parser.add_argument(
        "--password",
        dest="password",
        help="新的统一默认密码；若不传则读取 BULK_RESET_DEFAULT_PASSWORD",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    password = args.password or os.getenv("BULK_RESET_DEFAULT_PASSWORD")
    if not password:
        raise SystemExit("请通过 --password 或 BULK_RESET_DEFAULT_PASSWORD 提供统一默认密码")

    db = SessionLocal()
    try:
        result = bulk_reset_passwords(db, password)
    finally:
        db.close()

    print(f"[OK] 已重置用户密码数量: {result['updated_users']}")
    print("[INFO] 旧 JWT 已全部失效，请通知用户使用统一默认密码重新登录后再自行修改。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
