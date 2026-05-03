"""
Agent 数据访问层
"""
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
from models.agent_session import AgentSession, AgentStep, AgentToolCall


class AgentRepository:
    """Agent 数据访问层"""

    @staticmethod
    def create_session(
        db: Session,
        user_id: int,
        session_type: str,
        goal: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AgentSession:
        """创建 Agent 会话"""
        session = AgentSession(
            user_id=user_id,
            session_type=session_type,
            goal=goal,
            context=context or {},
            status="running"
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_session(db: Session, session_id: int) -> Optional[AgentSession]:
        """获取会话详情"""
        return db.query(AgentSession).filter(AgentSession.id == session_id).first()

    @staticmethod
    def get_session_for_user(
        db: Session,
        session_id: int,
        user_id: int
    ) -> Optional[AgentSession]:
        """获取指定用户的会话"""
        return db.query(AgentSession).filter(
            AgentSession.id == session_id,
            AgentSession.user_id == user_id
        ).first()

    @staticmethod
    def update_session_status(
        db: Session,
        session_id: int,
        status: str,
        completed_at: Optional[datetime] = None
    ) -> bool:
        """更新会话状态"""
        session = db.query(AgentSession).filter(AgentSession.id == session_id).first()
        if not session:
            return False

        session.status = status
        if completed_at:
            session.completed_at = completed_at
        db.commit()
        return True

    @staticmethod
    def resume_session(
        db: Session,
        session_id: int,
        session_type: Optional[str] = None,
    ) -> bool:
        """恢复会话到运行状态"""
        session = db.query(AgentSession).filter(AgentSession.id == session_id).first()
        if not session:
            return False

        session.status = "running"
        if session_type:
            session.session_type = session_type
        session.completed_at = None
        db.commit()
        return True

    @staticmethod
    def add_step(
        db: Session,
        session_id: int,
        step_number: int,
        step_type: str,
        content: str,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> AgentStep:
        """添加执行步骤"""
        step = AgentStep(
            session_id=session_id,
            step_number=step_number,
            step_type=step_type,
            content=content,
            extra_data=extra_data or {}
        )
        db.add(step)
        db.commit()
        db.refresh(step)
        return step

    @staticmethod
    def get_session_steps(db: Session, session_id: int) -> List[AgentStep]:
        """获取会话的所有步骤"""
        return db.query(AgentStep).filter(
            AgentStep.session_id == session_id
        ).order_by(AgentStep.step_number).all()

    @staticmethod
    def get_next_step_number(db: Session, session_id: int) -> int:
        """获取会话的下一个步骤编号"""
        latest = db.query(AgentStep).filter(
            AgentStep.session_id == session_id
        ).order_by(AgentStep.step_number.desc()).first()
        if not latest:
            return 0
        return int(latest.step_number) + 1

    @staticmethod
    def create_tool_call(
        db: Session,
        session_id: int,
        tool_name: str,
        input_params: Dict[str, Any],
        step_id: Optional[int] = None
    ) -> AgentToolCall:
        """创建工具调用记录"""
        tool_call = AgentToolCall(
            session_id=session_id,
            step_id=step_id,
            tool_name=tool_name,
            input_params=input_params,
            status="pending"
        )
        db.add(tool_call)
        db.commit()
        db.refresh(tool_call)
        return tool_call

    @staticmethod
    def update_tool_call(
        db: Session,
        tool_call_id: int,
        status: str,
        output_result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        execution_time_ms: int = 0
    ) -> bool:
        """更新工具调用结果"""
        tool_call = db.query(AgentToolCall).filter(AgentToolCall.id == tool_call_id).first()
        if not tool_call:
            return False

        tool_call.status = status
        tool_call.output_result = output_result
        tool_call.error_message = error_message
        tool_call.execution_time_ms = execution_time_ms
        db.commit()
        return True

    @staticmethod
    def get_session_tool_calls(db: Session, session_id: int) -> List[AgentToolCall]:
        """获取会话的所有工具调用"""
        return db.query(AgentToolCall).filter(
            AgentToolCall.session_id == session_id
        ).order_by(AgentToolCall.created_at).all()

    @staticmethod
    def get_user_sessions(
        db: Session,
        user_id: int,
        limit: int = 20,
        offset: int = 0
    ) -> List[AgentSession]:
        """获取用户的会话列表"""
        return db.query(AgentSession).filter(
            AgentSession.user_id == user_id
        ).order_by(AgentSession.created_at.desc()).offset(offset).limit(limit).all()
