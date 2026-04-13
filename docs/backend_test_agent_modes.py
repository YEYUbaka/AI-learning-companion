"""
Agent 系统端到端测试脚本
测试三种模式：ReAct, CoT, Function Calling
"""
import asyncio
import os
import sys
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models.users import User
from services.agent_service import AgentService
from core.logger import logger

TEST_PASSWORD = os.getenv("DOCS_TEST_PASSWORD")

if not TEST_PASSWORD:
    raise RuntimeError("请先设置 DOCS_TEST_PASSWORD 环境变量")

# 创建测试用户
def get_or_create_test_user(db: Session) -> User:
    """获取或创建测试用户"""
    user = db.query(User).filter(User.email == "test_agent@example.com").first()
    if not user:
        from core.security import hash_password
        user = User(
            name="测试用户",
            email="test_agent@example.com",
            hashed_password=hash_password(TEST_PASSWORD),
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

async def test_react_mode(db: Session, user_id: int):
    """测试 ReAct 模式"""
    print("\n" + "="*60)
    print("测试 1: ReAct 模式（推理+行动）")
    print("="*60)
    
    agent_service = AgentService(db)
    
    # 测试任务：生成一份测验
    goal = "生成一份包含 3 道题的数学测验"
    print(f"任务目标: {goal}")
    print("执行模式: ReAct")
    print("\n开始执行...")
    
    try:
        result = await agent_service.create_and_execute_task(
            user_id=user_id,
            goal=goal,
            mode="react"
        )
        
        print(f"\n执行结果:")
        print(f"  - 成功: {result.get('result', {}).get('success', False)}")
        print(f"  - 会话ID: {result.get('session_id')}")
        print(f"  - 迭代次数: {result.get('result', {}).get('iterations', 0)}")
        
        if result.get('result', {}).get('success'):
            answer = result.get('result', {}).get('answer', '')
            print(f"  - 最终答案: {answer[:200]}...")
            
            # 获取会话详情
            session = agent_service.get_session_history(result['session_id'])
            if session:
                print(f"\n执行步骤数: {len(session['steps'])}")
                print(f"工具调用数: {len(session['tool_calls'])}")
                
                # 显示前几个步骤
                print("\n前 5 个步骤:")
                for step in session['steps'][:5]:
                    print(f"  [{step['step_type']}] {step['content'][:100]}...")
        else:
            print(f"  - 错误: {result.get('result', {}).get('error')}")
            
        return result.get('result', {}).get('success', False)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_cot_mode(db: Session, user_id: int):
    """测试 Chain of Thought 模式"""
    print("\n" + "="*60)
    print("测试 2: Chain of Thought 模式（逐步思考）")
    print("="*60)
    
    agent_service = AgentService(db)
    
    # 测试任务：数学计算
    goal = "小明有 100 元，买了 3 本书每本 18 元，又买了 2 支笔每支 5 元，还剩多少钱？"
    print(f"任务目标: {goal}")
    print("执行模式: CoT")
    print("\n开始执行...")
    
    try:
        result = await agent_service.create_and_execute_task(
            user_id=user_id,
            goal=goal,
            mode="cot"
        )
        
        print(f"\n执行结果:")
        print(f"  - 成功: {result.get('result', {}).get('success', False)}")
        print(f"  - 会话ID: {result.get('session_id')}")
        print(f"  - 思考步骤数: {result.get('result', {}).get('steps', 0)}")
        
        if result.get('result', {}).get('success'):
            answer = result.get('result', {}).get('answer', '')
            print(f"  - 最终答案: {answer}")
            
            # 获取会话详情
            session = agent_service.get_session_history(result['session_id'])
            if session:
                print(f"\n思考过程:")
                for step in session['steps']:
                    if step['step_type'] == 'thought':
                        print(f"  {step['content']}")
        else:
            print(f"  - 错误: {result.get('result', {}).get('error')}")
            
        return result.get('result', {}).get('success', False)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_function_calling_mode(db: Session, user_id: int):
    """测试 Function Calling 模式"""
    print("\n" + "="*60)
    print("测试 3: Function Calling 模式（原生工具调用）")
    print("="*60)
    
    agent_service = AgentService(db)
    
    # 测试任务：生成学习计划
    goal = "生成一个 7 天的 Python 基础学习计划"
    print(f"任务目标: {goal}")
    print("执行模式: Function Calling")
    print("\n开始执行...")
    
    try:
        result = await agent_service.create_and_execute_task(
            user_id=user_id,
          goal=goal,
            mode="function_calling"
        )
        
        print(f"\n执行结果:")
        print(f"  - 成功: {result.get('result', {}).get('success', False)}")
        print(f"  - 会话ID: {result.get('session_id')}")
        
        if result.get('result', {}).get('success'):
            answer = result.get('result', {}).get('answer', '')
            print(f"  - 最终答案: {answer[:200]}...")
            
            # 获取会话详情
            session = agent_service.get_session_history(result['session_id'])
            if session:
                print(f"\n工具调用:")
                for tool_call in session['tool_calls']:
                    print(f"  - {tool_call['tool_name']}: {tool_call['status']}")
        else:
            print(f"  - 错误: {result.get('result', {}).get('error')}")
            
        return result.get('result', {}).get('success', False)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """主测试函数"""
    print("\n" + "="*60)
    print("智学伴 Agent 系统 - 端到端测试")
    print("="*60)
    
    # 创建数据库表
    Base.metadata.create_all(bind=engine)
    
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 获取或创建测试用户
        user = get_or_create_test_user(db)
        print(f"\n测试用户: {user.name} (ID: {user.id})")
        
        # 运行测试
        results = []
        
        # 测试 1: ReAct 模式
        results.append(("ReAct", await test_react_mode(db, user.id)))
        
        # 测试 2: CoT 模式
        results.append(("CoT", await test_cot_mode(db, user.id)))
        
        # 测试 3: Function Calling 模式
        results.append(("Function Calling", await test_function_calling_mode(db, user.id)))
        
        # 输出测试总结
        print("\n" + "="*60)
        print("测试总结")
        print("="*60)
        
        for mode, success in results:
            status = "✅ 通过" if success else "❌ 失败"
            print(f"{mode:20s}: {status}")
        
        # 计算通过率
        passed = sum(1 for _, success in results if success)
        total = len(results)
        print(f"\n通过率: {passed}/{total} ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("\n🎉 所有测试通过！")
            return 0
        else:
            print(f"\n⚠️  {total - passed} 个测试失败")
            return 1
            
    finally:
        db.close()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
