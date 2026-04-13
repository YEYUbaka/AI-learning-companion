"""
Agent 系统简化测试脚本
"""
import asyncio
import os
import sys
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models.base import Base
from models.users import User
from services.agent_service import AgentService
from core.logger import logger
from passlib.context import CryptContext

# 创建所有表
Base.metadata.create_all(bind=engine)

# 密码加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
TEST_PASSWORD = os.getenv("DOCS_TEST_PASSWORD")

if not TEST_PASSWORD:
    raise RuntimeError("请先设置 DOCS_TEST_PASSWORD 环境变量")


def create_test_user(db: Session) -> int:
    """创建测试用户"""
    # 检查是否已存在
    existing_user = db.query(User).filter(User.email == "test_agent@example.com").first()
    if existing_user:
        print(f"[INFO] 使用现有测试用户 ID: {existing_user.id}")
        return existing_user.id

    # 创建新用户
    user = User(
        name="测试用户",
        email="test_agent@example.com",
        hashed_password=pwd_context.hash(TEST_PASSWORD),
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"[INFO] 创建测试用户 ID: {user.id}")
    return user.id


async def test_basic_agent():
    """基础 Agent 测试"""
    print("\n" + "="*60)
    print("[TEST] Agent 基础功能测试")
    print("="*60)

    db = SessionLocal()
    try:
        # 创建测试用户
        user_id = create_test_user(db)

        # 创建 Agent 服务
        service = AgentService(db)

        # 测试 1: 简单的 ReAct 任务
        print("\n[TEST 1] ReAct 模式 - 网络搜索")
        result = await service.create_and_execute_task(
            user_id=user_id,
            goal="搜索 Python 最佳实践",
            mode="react"
        )

        if result.get('session_id'):
            print(f"[OK] 会话创建成功 ID: {result['session_id']}")

            # 获取会话历史
            history = service.get_session_history(result['session_id'])
            if history:
                print(f"[OK] 执行步骤数: {len(history['steps'])}")
                print(f"[OK] 工具调用数: {len(history['tool_calls'])}")

                # 检查重复步骤
                step_contents = [step['content'] for step in history['steps']]
                unique_contents = set(step_contents)
                if len(step_contents) == len(unique_contents):
                    print("[OK] 无重复步骤")
                else:
                    print(f"[WARNING] 发现 {len(step_contents) - len(unique_contents)} 个重复步骤")

                # 显示最终答案
                final_steps = [s for s in history['steps'] if s['step_type'] == 'final_answer']
                if final_steps:
                    answer = final_steps[0]['content']
                    print(f"\n[RES:\n{answer[:200]}...")
                else:
                    print("[WARNING] 未找到最终答案")

                return True
            else:
                print("[ERROR] 无法获取会话历史")
                return False
        else:
            print(f"[ERROR] 任务执行失败: {result.get('error', '未知错误')}")
            return False

    except Exception as e:
        print(f"[ERROR] 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


async def test_tool_execution():
    """测试工具执行"""
    print("\n" + "="*60)
    print("[TEST] 工具执行测试")
    print("="*60)

    db = SessionLocal()
    try:
        user_id = create_test_user(db)
        service = AgentService(db)

        print("\n[TEST 2] 工具调用 - 生成学习计划")
        result = await service.create_and_execute_task(
            user_id=user_id,
            goal="为我生成一个 3 天的 Python 基础学习计划",
            mode="react"
        )

        if result.get('session_id'):
            history = service.get_session_history(result['session_id'])
            if history:
                tool_names = [call['tool_name'] for call in history['tool_calls']]
                print(f"[OK] 调用的工具: {', '.join(tool_names)}")

                # 检查工具执行成功率
                success_count = sum(1 for call in history['tool_calls'] if call['status'] == 'success')
                total_count = len(history['tool_calls'])
                if total_count > 0:
                    success_rate = (success_count / total_count * 100)
                    print(f"[OK] 工具执行成功率: {success_rate:.1f}% ({success_count}/{total_count})")

                    if 'generate_study_plan' in tool_names:
                        print("[OK] 成功调用学习计划工具")
                        return True
                    else:
                        print("[WARNING] 未调用学习计划工具")
                        return False
                else:
                    print("[WARNING] 未调用任何工具")
                    return False
        else:
            print(f"[ERROR] 任务执行失败: {result.get('error', '未知错误')}")
            return False

    except Exception as e:
        print(f"[ERROR] 测试失败: {str(e)}")
        return False
    finally:
        db.close()


async def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("Agent 系统测试套件")
    print("="*60)

    results = []

    # 运行测试
    print("\n[INFO] 开始测试...")
    results.append(("基础功能", await test_basic_agent()))
    results.append(("工具执行", await test_tool_execution()))

    # 汇总结果
    print("\n" + "="*60)
    print("测试结果汇总")
    print("="*60)

    for test_name, success in results:
        status = "[PASS]" if success else "[FAIL]"
        print(f"{test_name}: {status}")

    success_count = sum(1 for _, success in results if success)
    total_count = len(results)
    success_rate = (success_count / total_count * 100) if total_count > 0 else 0

    print(f"\n总体成功率: {success_rate:.1f}% ({success_count}/{total_count})")

    if success_rate >= 50:
        print("\n[SUCCESS] Agent 系统基本功能正常")
        return 0
    else:
        print("\n[WARNING] Agent 系统需要优化")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n[INFO] 测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] 测试异常: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
