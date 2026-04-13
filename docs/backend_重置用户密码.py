"""
单用户密码重置脚本。

说明：
    - 本脚本仅接受运行时参数，不内置真实密码。
    - 全库统一重置请改用 backend/scripts/reset_all_user_passwords.py。

示例：
    python docs/backend_重置用户密码.py admin@example.com "YourStrongPass!9" --name 管理员 --role admin
"""
import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal  # noqa: E402
from core.security import hash_password  # noqa: E402
from models.users import User  # noqa: E402
from repositories.user_repo import UserRepository  # noqa: E402
from utils.password_policy import validate_password  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="重置单个用户密码，或在不存在时创建用户")
    parser.add_argument("email", help="目标邮箱")
    parser.add_argument("new_password", help="运行时输入的新密码")
    parser.add_argument("--name", default=None, help="用户名称，创建用户时可选")
    parser.add_argument("--role", default="user", choices=["user", "admin"], help="用户角色")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    validate_password(args.new_password)

    db = SessionLocal()
    try:
        user = UserRepository.get_by_email(db, args.email)

        if user:
            updated_user = UserRepository.update_password(
                db,
                user.id,
                hash_password(args.new_password),
            )
            if args.name or args.role != updated_user.role:
                updated_user.name = args.name or updated_user.name
                updated_user.role = args.role
                db.commit()
                db.refresh(updated_user)
            action = "updated"
            target_user = updated_user
        else:
            target_user = UserRepository.create(
                db=db,
                email=args.email,
                name=args.name or args.email.split("@")[0],
                hashed_password=hash_password(args.new_password),
                role=args.role,
            )
            action = "created"
    finally:
        db.close()

    print("=" * 60)
    print(f"[OK] 用户已{action}: {target_user.email}")
    print(f"[INFO] role={target_user.role}, token_version={target_user.token_version}")
    print("[INFO] 新密码未回显，请通过你输入的运行时参数自行保管")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
