import pytest

from utils.paper_exporter import PaperExporter


def test_normalize_answer_key_accepts_list_payload():
    answer_key = [
        {"question_id": "Q1", "answer": "A"},
        {"question_id": "Q2", "answer": "B"},
    ]

    normalized = PaperExporter._normalize_answer_key(answer_key)

    assert normalized["1"]["answer"] == "A"
    assert normalized["2"]["answer"] == "B"


def test_normalize_export_questions_uses_stem_as_fallback():
    questions = [{"stem": "已知函数 f(x) 的定义域是？", "points": 6}]

    normalized = PaperExporter._normalize_export_questions(questions)

    assert normalized[0]["question"] == "已知函数 f(x) 的定义域是？"
    assert normalized[0]["points"] == 6


def test_export_pdf_handles_latex_and_question_bank_image(tmp_path, monkeypatch):
    try:
        from PIL import Image
    except ImportError:
        pytest.skip("Pillow unavailable")

    monkeypatch.chdir(tmp_path)
    image_dir = tmp_path / "uploads" / "question-bank" / "1"
    image_dir.mkdir(parents=True)
    image_path = image_dir / "figure.png"
    Image.new("RGB", (120, 60), color="white").save(image_path)

    output_path = tmp_path / "paper.pdf"
    PaperExporter.export_to_pdf(
        {
            "title": "公式导出测试",
            "subject": "数学",
            "grade_level": "初中",
            "total_questions": 1,
            "time_limit": 30,
            "questions": [
                {
                    "type": "calculation",
                    "question": "解一元二次方程 $x^2-5x+6=0$，并计算 \\frac{1}{2} 的值",
                    "options": ["A. $x=2$", "B. $x=3$"],
                    "answer": "$x_1=2,x_2=3$",
                    "explanation": "\\begin{cases}x=2\\\\x=3\\end{cases}",
                    "points": 10,
                    "question_images": [{"file_path": "question-bank/1/figure.png"}],
                }
            ],
            "answer_key": [{"answer": "$x_1=2,x_2=3$"}],
        },
        str(output_path),
    )

    assert output_path.exists()
    assert output_path.stat().st_size > 0
