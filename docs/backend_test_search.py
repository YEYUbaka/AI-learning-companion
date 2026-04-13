"""
测试 Agent 搜索功能
"""
import asyncio
import os
import sys
from sqlalchemy.orm import Session
from database import SessionLocal
from models.users import User
from services.agent_service import AgentService
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
TEST_PASSWORD = os.getenv("DOCS_TEST_PASSWORD")

if not TEST_PASSWORD:
    raise RuntimeError("请先设置 DOCS_TEST_PASSWORD 环境变量")


def get_or_create_test_user(db: Session) -> int:
    """获取或创建测试用户"""
    user = db.query(User).filter(User.email == "test_agent@example.com").first()
    if user:
        return user.id

    user = User(
        name="测试用户",
        email="test_agent@example.com",
        hashed_password=pwd_context.hash(TEST_PASSWORD),
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


async def test_search():
    """测试搜索功能"""
    print("\n" + "="*60)
    print("测试：搜索Python异步编程教程")
    print("="*60)

    db = SessionLocal()
    try:
        user_id = get_or_create_test_user(db)
        service = AgentService(db)

        print("\n[1] 创建搜索任务...")
        result = await service.create_and_execute_task(
            user_id=user_id,
            goal="搜索Python异步编程教程",
            mode="react"
        )

        session_id = result.get('session_id')
        print(f"[2] 会话 ID: {session_id}")

        # 获取会话详情
        history = service.get_session_history(session_id)
        if not history:
            print("[ERROR] 无法获取会话历史")
            return False

        print(f"[3] 状态: {history['status']}")

        # 检查工具调用
        tool_names = [call['tool_name'] for call in history['tool_calls']]
        print(f"\n[检查] 调用的工具: {', '.join(tool_names) if tool_names else '无'}")

        if 'web_search' not in tool_names:
            print("[ERROR] 没有调用 web_search 工具！")
            print("[ERROR] AI 应该调用搜索工具，但它选择了直接回答")
            return False

        print("[OK] 成功调用了 web_search 工具")

        # 检查最终答案是否包含链接
        final_answers = [s for s in history['steps'] if s['step_type'] == 'final_answer']
        if final_answers:
            answer = final_answers[0]['content']
            print(f"\n[检查] 最终答案长度: {len(answer)} 字符")

            # 检查是否包含 Markdown 链接
            if '[' in answer and '](' in answer and 'http' in answer:
                print("[OK] 答案包含 Markdown 链接")

                # 统计链接数量
                link_count = answer.count('](http')
                print(f"[OK] 找到 {link_count} 个链接")

                return True
            else:
                print("[ERROR] 答案不包含可点击的链接！")
                print("[ERROR] 应该使用 Markdown 格式：[文本](URL)")
                return False
        else:
            print("[ERROR] 没有最终答案")
            return False

    except Exception as e:
        print(f"\n[ERROR] 测试异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


async def main():
    """运行测试"""
    print("\n" + "="*60)
    print("Agent 搜索功能测试")
    print("="*60)

    success = await test_search()

    print("\n" + "="*60)
    print("测试结果")
    print("="*60)

    if success:
        print("[SUCCESS] 搜索功能正常 - 调用了工具并返回了链接")
        return 0
    else:
        print("[FAILED] 搜索功能异常 - 未调用工具或未返回链接")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n[INFO] 测试被中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] 测试异常: {str(e)}")
        sys.exit(1)
