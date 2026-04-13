"""
测试 Agent 是否正确调用工具（而非只说要调用）
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


async def test_simple_task():
    """测试简单任务：生成7天Python学习计划"""
    print("\n" + "="*60)
    print("测试：生成7天Python学习计划")
    print("="*60)

    db = SessionLocal()
    try:
        user_id = get_or_create_test_user(db)
        service = AgentService(db)

        print("\n[1] 创建任务...")
        result = await service.create_and_execute_task(
            user_id=user_id,
            goal="帮我设计一个7天的Python学习计划",
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
        print(f"[4] 总步骤数: {len(history['steps'])}")

        # 分析步骤
        thoughts = [s for s in history['steps'] if s['step_type'] == 'thought']
        actions = [s for s in history['steps'] if s['step_type'] == 'action']
        observations = [s for s in history['steps'] if s['step_type'] == 'observation']
        final_answers = [s for s in history['steps'] if s['step_type'] == 'final_answer']

        print(f"\n[分析] Thought 步骤: {len(thoughts)}")
        print(f"[分析] Action 步骤: {len(actions)}")
        print(f"[分析] Observation 步骤: {len(observations)}")
        print(f"[分析] Final Answer 步骤: {len(final_answers)}")

        # 检查是否有"只说不做"的问题
        print("\n[检查] 是否存在'只说不做'问题...")
        bad_thoughts = []
        for t in thoughts:
            content = t['content'].lower()
            if any(kw in content for kw in ["需要调用", "应该调用", "调用工具"]):
                bad_thoughts.append(t)

        if bad_thoughts:
            print(f"[WARNING] 发现 {len(bad_thoughts)} 个'只说不做'的 Thought:")
            for bt in bad_thoughts[:3]:  # 只显示前3个
                print(f"  - {bt['content'][:80]}...")
        else:
            print("[OK] 未发现'只说不做'问题")

        # 检查工具调用
        print("\n[检查] 工具调用情况...")
        if len(actions) == 0:
            print("[ERROR] 没有调用任何工具！")
            return False
        elif len(actions) > 3:
            print(f"[WARNING] 调用了 {len(actions)} 个工具，可能过多")
        else:
            print(f"[OK] 调用了 {len(actions)} 个工具")

        # 显示调用的工具
        tool_names = [call['tool_name'] for call in history['tool_calls']]
        print(f"[INFO] 调用的工具: {', '.join(tool_names)}")

        # 检查是否调用了不必要的工具
        unnecessary_tools = []
        if 'parse_file' in tool_names:
            print("[WARNING] 调用了 parse_file，但用户没有上传文件！")
            unnecessary_tools.append('parse_file')

        # 检查最终状态
        print(f"\n[结果] 最终状态: {history['status']}")
        if history['status'] == 'completed':
            print("[OK] 任务成功完成")
            if len(final_answers) > 0:
                answer = final_answers[0]['content']
                print(f"[OK] 最终答案长度: {len(answer)} 字符")
                print(f"[预览] {answer[:200]}...")
            return True
        else:
            print(f"[ERROR] 任务失败: {history['status']}")
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
    print("Agent '只说不做' 问题测试")
    print("="*60)

    success = await test_simple_task()

    print("\n" + "="*60)
    print("测试结果")
    print("="*60)

    if success:
        print("[SUCCESS] 测试通过 - Agent 正确调用了工具")
        return 0
    else:
        print("[FAILED] 测试失败 - Agent 仍然存在问题")
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
