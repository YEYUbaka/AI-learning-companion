import pytest

from routers.quiz import SubmitQuizRequest, quiz_submit
from utils.quiz_generator import normalize_evaluation_result


def test_normalize_evaluation_result_supports_is_correct_and_knowledge_point_fallback():
    questions = [
        {
            "question": "函数 f(x)=2x+1 中，f(2) 等于多少？",
            "answer": "5",
            "type": "fill",
            "knowledge_point": "一次函数求值",
        },
        {
            "question": "下列哪个是 Python 定义函数的关键字？",
            "answer": "B",
            "type": "choice",
            "options": ["A. function", "B. def", "C. define", "D. func"],
            "knowledge_points": ["Python 函数定义"],
        },
    ]
    user_answers = ["4", "B"]
    result_data = {
        "score": "50",
        "explanations": [
            {
                "question": questions[0]["question"],
                "is_correct": False,
                "explanation": "代入计算时出错。",
            },
            {
                "question": questions[1]["question"],
                "correct": True,
                "explanation": "回答正确。",
            },
        ],
        "suggestions": "优先回看一次函数求值相关题目，并整理代入计算步骤。",
    }

    normalized = normalize_evaluation_result(result_data, questions, user_answers)

    assert normalized["score"] == 50
    assert normalized["correct_count"] == 1
    assert normalized["total_count"] == 2
    assert normalized["explanations"][0]["correct"] is False
    assert normalized["explanations"][0]["is_correct"] is False
    assert normalized["explanations"][0]["user_answer"] == "4"
    assert normalized["weak_points"][0]["knowledge_point"] == "一次函数求值"
    assert normalized["next_steps"]


class DummyQuiz:
    def __init__(self, **kwargs):
        self.id = 123
        for key, value in kwargs.items():
            setattr(self, key, value)


class DummyDB:
    def __init__(self):
        self.added = None
        self.rollback_called = False

    def add(self, obj):
        self.added = obj

    def commit(self):
        return None

    def refresh(self, obj):
        return obj

    def rollback(self):
        self.rollback_called = True


@pytest.mark.asyncio
async def test_quiz_submit_returns_extended_result_fields(monkeypatch):
    def fake_evaluate_quiz(**kwargs):
        return {
            "score": 80,
            "total_score": 100,
            "correct_count": 4,
            "total_count": 5,
            "summary": "主要问题集中在一次函数图像理解。",
            "weak_points": [
                {
                    "knowledge_point": "一次函数图像",
                    "reason": "斜率与截距判断有混淆。",
                    "related_questions": [1, 3],
                }
            ],
            "next_steps": [
                "先复习斜率和截距的含义，再重做关联错题。",
                "整理一次函数图像判读的常见误区。",
            ],
            "explanations": [
                {
                    "question": "示例题目",
                    "correct": False,
                    "is_correct": False,
                    "explanation": "示例解析",
                }
            ],
        }

    monkeypatch.setattr("routers.quiz.evaluate_quiz", fake_evaluate_quiz)
    monkeypatch.setattr("routers.quiz.Quiz", DummyQuiz)

    request = SubmitQuizRequest(
        user_id=1,
        topic="一次函数",
        questions=[{"question": "示例题目", "answer": "A", "type": "choice"}],
        answers=["B"],
    )
    db = DummyDB()

    result = await quiz_submit(request, db=db)

    assert result["success"] is True
    assert result["score"] == 80
    assert result["total_score"] == 100
    assert result["correct_count"] == 4
    assert result["total_count"] == 5
    assert result["summary"] == "主要问题集中在一次函数图像理解。"
    assert result["weak_points"][0]["knowledge_point"] == "一次函数图像"
    assert len(result["next_steps"]) == 2
    assert result["quiz_id"] == 123
    assert db.rollback_called is False
