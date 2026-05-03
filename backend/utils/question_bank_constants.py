"""
Question bank constants - grade levels, subjects, question types, and difficulty levels.
Provides normalization functions for validated input.
"""
from __future__ import annotations

from typing import Optional

GRADE_LEVELS = [
    "小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
    "初中一年级", "初中二年级", "初中三年级",
    "高中一年级", "高中二年级", "高中三年级",
]

GRADE_LEVEL_ALIASES: dict = {
    "小学": "小学六年级",
    "初一": "初中一年级", "初二": "初中二年级", "初三": "初中三年级",
    "初中": "初中三年级",
    "高一": "高中一年级", "高二": "高中二年级", "高三": "高中三年级",
    "高中": "高中三年级",
}

SUBJECTS = [
    "语文", "数学", "英语", "物理", "化学", "生物",
    "历史", "地理", "道德与法治", "信息技术", "科学",
]

QUESTION_TYPES = [
    {"value": "choice", "label": "单选题"},
    {"value": "multiple_choice", "label": "多选题"},
    {"value": "fill", "label": "填空题"},
    {"value": "judge", "label": "判断题"},
    {"value": "essay", "label": "简答题"},
    {"value": "calculation", "label": "计算题"},
    {"value": "comprehensive", "label": "综合题"},
    {"value": "composition", "label": "作文题"},
]

DIFFICULTY_LEVELS = [
    {"value": "easy", "label": "简单"},
    {"value": "medium", "label": "中等"},
    {"value": "hard", "label": "困难"},
]


def normalize_grade_level(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = str(value).strip()
    if text in GRADE_LEVELS:
        return text
    if text in GRADE_LEVEL_ALIASES:
        return GRADE_LEVEL_ALIASES[text]
    return None


def normalize_subject(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = str(value).strip()
    if text in SUBJECTS:
        return text
    return None


def is_valid_grade_level(value: Optional[str]) -> bool:
    return normalize_grade_level(value) is not None


def is_valid_subject(value: Optional[str]) -> bool:
    return normalize_subject(value) is not None
