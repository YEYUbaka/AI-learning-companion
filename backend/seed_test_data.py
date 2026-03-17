"""
测试数据填充脚本 - 为 Dashboard 图表提供演示数据
用法：在 backend 目录下运行 python seed_test_data.py [user_id]
"""
import sys
import json
from datetime import datetime, timedelta
import random
from database import SessionLocal
from models.quizzes import Quiz
from models.study_plans import StudyPlan

# 目标用户 ID（默认 8 = student1@test.com）
TARGET_USER_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 8

TOPICS = ["高等数学", "线性代数", "Python编程", "数据结构", "计算机网络", "操作系统"]

SAMPLE_QUESTIONS = json.dumps([
    {"question": "以下哪个是正确答案？", "options": ["A", "B", "C", "D"], "correct": "A"},
    {"question": "下列说法正确的是？", "options": ["甲", "乙", "丙", "丁"], "correct": "丙"},
    {"question": "计算结果为？", "options": ["1", "2", "3", "4"], "correct": "2"},
])

SAMPLE_ANSWERS = json.dumps(["A", "丙", "2"])
SAMPLE_EXPLANATIONS = json.dumps([
    "选项A正确，因为...",
    "丙选项正确，分析如下...",
    "正确答案是2，计算过程..."
])

def seed_quizzes(db, user_id: int):
    # 清除现有记录（只清除该用户的）
    existing = db.query(Quiz).filter(Quiz.user_id == user_id).count()
    if existing > 0:
        print(f"[INFO] 用户 {user_id} 已有 {existing} 条记录，追加测试数据")

    now = datetime.now()
    records = []

    # 生成 30 条带时间分布的测试记录
    score_sequence = [
        45, 52, 58, 63, 70, 68, 75, 72, 80, 78,
        82, 76, 85, 88, 84, 90, 87, 92, 89, 94,
        85, 91, 88, 95, 90, 93, 87, 96, 92, 97,
    ]

    for i, score in enumerate(score_sequence):
        # 分散到过去 90 天内
        days_ago = 90 - (i * 3)
        created_at = now - timedelta(days=days_ago, hours=random.randint(0, 6))
        topic = TOPICS[i % len(TOPICS)]

        quiz = Quiz(
            user_id=user_id,
            topic=topic,
            questions=SAMPLE_QUESTIONS,
            answers=SAMPLE_ANSWERS,
            score=score,
            explanations=SAMPLE_EXPLANATIONS,
            created_at=created_at,
        )
        records.append(quiz)

    db.add_all(records)
    print(f"[OK] 插入 {len(records)} 条测验记录")


def seed_plans(db, user_id: int):
    existing = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).count()
    if existing >= 3:
        print(f"[INFO] 用户 {user_id} 已有 {existing} 个学习计划，跳过")
        return

    plans_data = [
        {"goal": "掌握 Python 数据分析基础", "file_name": "python_intro.pdf"},
        {"goal": "备考线性代数期末考试", "file_name": "linear_algebra.pdf"},
        {"goal": "学习计算机网络协议", "file_name": "network.pdf"},
    ]

    for p in plans_data:
        # plan_json 必须是 List[Dict] 格式（直接的 JSON 数组，不能套 dict 包装）
        plan = StudyPlan(
            user_id=user_id,
            goal=p["goal"],
            file_name=p["file_name"],
            plan_json=json.dumps([
                {"week": 1, "title": "基础入门", "tasks": ["阅读教材", "完成练习题", "整理笔记"]},
                {"week": 2, "title": "深入理解", "tasks": ["综合练习", "模拟测试", "查漏补缺"]},
                {"week": 3, "title": "巩固提升", "tasks": ["刷历年真题", "总结易错点", "冲刺复习"]},
            ], ensure_ascii=False),
        )
        db.add(plan)

    print(f"[OK] 插入 {len(plans_data)} 个学习计划")


def main():
    db = SessionLocal()
    try:
        print(f"\n[START] 开始为用户 ID={TARGET_USER_ID} 填充测试数据")
        seed_quizzes(db, TARGET_USER_ID)
        seed_plans(db, TARGET_USER_ID)
        db.commit()
        print(f"[DONE] 测试数据填充完成！\n")
        print(f"  请用 student1@test.com 登录查看效果")
        print(f"  密码请查看 backend 初始化脚本或使用 admin 重置\n")
    except Exception as e:
        db.rollback()
        print(f"[FAIL] 填充失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
