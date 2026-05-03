from types import SimpleNamespace

from services.agent_service import AgentService


def test_get_session_history_builds_timeline_from_legacy_steps(monkeypatch):
    service = AgentService(db=object())

    session = SimpleNamespace(
        id=7,
        goal="Explain Newton's second law",
        status="completed",
        session_type="react",
        context={"attachments": []},
        created_at=None,
        updated_at=None,
        completed_at=None,
    )
    steps = [
        SimpleNamespace(step_number=0, step_type="goal", content="Explain Newton's second law", extra_data={}, created_at=None),
        SimpleNamespace(step_number=1, step_type="thought", content="Start with the concept and then give an example.", extra_data={}, created_at=None),
        SimpleNamespace(
            step_number=2,
            step_type="action",
            content='search_knowledge: {"query":"Newton second law"}',
            extra_data={"tool_name": "search_knowledge", "tool_input": {"query": "Newton second law"}},
            created_at=None,
        ),
        SimpleNamespace(
            step_number=3,
            step_type="observation",
            content='{"success": true, "text": "Matched a relevant knowledge point"}',
            extra_data={"quality_status": "verified", "confidence": 0.9},
            created_at=None,
        ),
        SimpleNamespace(
            step_number=4,
            step_type="final_answer",
            content="Newton's second law can be written as F = ma.",
            extra_data={"quality_status": "pass", "confidence": 0.92},
            created_at=None,
        ),
    ]

    monkeypatch.setattr(service.repo, "get_session_for_user", lambda db, session_id, user_id: session)
    monkeypatch.setattr(service.repo, "get_session_steps", lambda db, session_id: steps)
    monkeypatch.setattr(service.repo, "get_session_tool_calls", lambda db, session_id: [])

    history = service.get_session_history(7, user_id=3)

    assert history is not None
    assert history["title"] == "Explain Newton's second law"
    assert len(history["timeline"]) == 2
    assert history["timeline"][0]["role"] == "user"
    assert history["timeline"][0]["content"] == "Explain Newton's second law"
    assert history["timeline"][1]["role"] == "assistant"
    assert history["timeline"][1]["thinking"] == "Start with the concept and then give an example."
    assert history["timeline"][1]["content"] == "Newton's second law can be written as F = ma."
    assert history["timeline"][1]["tool_uses"][0]["tool_name"] == "search_knowledge"
    assert history["timeline"][1]["tool_uses"][0]["status"] == "success"
    assert history["timeline"][1]["tool_uses"][0]["output"]["text"] == "Matched a relevant knowledge point"


def test_create_or_resume_session_appends_user_message_with_next_turn(monkeypatch):
    service = AgentService(db=object())
    existing_session = SimpleNamespace(id=11)
    existing_steps = [
        SimpleNamespace(step_type="user_message"),
        SimpleNamespace(step_type="final_answer"),
    ]
    captured = {}

    monkeypatch.setattr(service.repo, "get_session_for_user", lambda db, session_id, user_id: existing_session)
    monkeypatch.setattr(service.repo, "resume_session", lambda db, session_id, session_type=None: True)
    monkeypatch.setattr(service.repo, "get_session_steps", lambda db, session_id: existing_steps)
    monkeypatch.setattr(service.repo, "get_next_step_number", lambda db, session_id: 5)

    def fake_add_step(db, session_id, step_number, step_type, content, extra_data=None):
        captured.update(
            {
                "session_id": session_id,
                "step_number": step_number,
                "step_type": step_type,
                "content": content,
                "extra_data": extra_data or {},
            }
        )

    monkeypatch.setattr(service.repo, "add_step", fake_add_step)

    session, event_type, turn_index = service.create_or_resume_session(
        user_id=9,
        message="Continue and explain how it relates to acceleration.",
        mode="react",
        context={"attachments": []},
        session_id=11,
    )

    assert session is existing_session
    assert event_type == "session_resumed"
    assert turn_index == 2
    assert captured["session_id"] == 11
    assert captured["step_number"] == 5
    assert captured["step_type"] == "user_message"
    assert captured["content"] == "Continue and explain how it relates to acceleration."
    assert captured["extra_data"]["turn_index"] == 2
