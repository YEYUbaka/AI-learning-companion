"""
试卷模板配置
目的：优先从 JSON 模板库读取试卷蓝图，便于后续按真实试卷持续扩充
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional


STANDARD_TYPE_KEYS = [
    "choice",
    "multiple_choice",
    "fill",
    "judge",
    "essay",
    "calculation",
    "comprehensive",
    "composition",
]


class PaperTemplates:
    """试卷模板读取器"""

    DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "paper_templates"

    TYPE_NAMES = {
        "choice": "单选题",
        "multiple_choice": "多选题",
        "fill": "填空题",
        "judge": "判断题",
        "essay": "简答题",
        "calculation": "计算题",
        "comprehensive": "综合题",
        "composition": "作文题",
        "application": "应用题",
        "reading": "阅读理解题",
        "word_choice": "选词填空题",
        "cloze": "完形填空题",
        "translation": "翻译题",
        "experiment": "实验探究题",
        "proof": "证明题",
        "listening": "听力题",
    }

    PAPER_TYPE_KEYWORDS = {
        "unit_test": ["单元", "章节", "课时", "同步", "模块"],
        "comprehensive_review": ["综合", "复习", "专题", "总复习"],
        "mock_exam": ["月考", "联考", "模拟", "期中", "期末", "模考"],
        "special_training": ["专项", "强化", "突破", "提升"],
    }

    @staticmethod
    def _normalize_text(value: Optional[str]) -> str:
        return (value or "").strip().lower()

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_documents() -> List[Dict[str, Any]]:
        documents: List[Dict[str, Any]] = []

        if PaperTemplates.DATA_DIR.exists():
            for path in sorted(PaperTemplates.DATA_DIR.rglob("*.json")):
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                except Exception:
                    continue

                if isinstance(payload, dict) and isinstance(payload.get("templates"), list):
                    payload["_source_file"] = str(path.relative_to(PaperTemplates.DATA_DIR))
                    documents.append(payload)

        if documents:
            return documents + PaperTemplates._fallback_documents()
        return PaperTemplates._fallback_documents()

    @staticmethod
    def infer_paper_type(title: Optional[str] = None, paper_type: Optional[str] = None) -> Optional[str]:
        if paper_type:
            return paper_type

        normalized_title = (title or "").strip()
        if not normalized_title:
            return None

        for candidate, keywords in PaperTemplates.PAPER_TYPE_KEYWORDS.items():
            if any(keyword in normalized_title for keyword in keywords):
                return candidate

        return None

    @staticmethod
    def _doc_score(doc: Dict[str, Any], grade_level: str, subject: Optional[str]) -> int:
        score = 0
        doc_grade = doc.get("grade_level")
        doc_subject = doc.get("subject")

        if doc_grade == grade_level:
            score += 20
        elif doc_grade in {"通用", "general", "", None}:
            score += 5

        if subject and doc_subject == subject:
            score += 10
        elif doc_subject in {"通用", "general", "", None}:
            score += 2

        return score

    @staticmethod
    def _is_generic_subject(value: Optional[str]) -> bool:
        return value in {"通用", "general", "", None}

    @staticmethod
    def _pick_document(grade_level: str, subject: Optional[str]) -> Dict[str, Any]:
        documents = PaperTemplates._load_documents()
        exact_candidates = [
            item
            for item in documents
            if item.get("grade_level") == grade_level
            and (
                not subject
                or item.get("subject") == subject
                or PaperTemplates._is_generic_subject(item.get("subject"))
            )
        ]
        if exact_candidates:
            ranked_exact = sorted(
                exact_candidates,
                key=lambda item: PaperTemplates._doc_score(item, grade_level, subject),
                reverse=True,
            )
            return ranked_exact[0]

        ranked = sorted(
            documents,
            key=lambda item: PaperTemplates._doc_score(item, grade_level, subject),
            reverse=True,
        )
        return ranked[0] if ranked else PaperTemplates._fallback_documents()[0]

    @staticmethod
    def _pick_template_entry(doc: Dict[str, Any], paper_type: Optional[str]) -> Dict[str, Any]:
        templates = doc.get("templates") or []
        if not templates:
            return {}

        if paper_type:
            exact = next((item for item in templates if item.get("paper_type") == paper_type), None)
            if exact:
                return exact

        default_id = doc.get("default_template_id")
        if default_id:
            default_template = next((item for item in templates if item.get("template_id") == default_id), None)
            if default_template:
                return default_template

        return templates[0]

    @staticmethod
    def _normalize_distribution(distribution: Optional[Dict[str, Any]]) -> Dict[str, int]:
        normalized = {key: 0 for key in STANDARD_TYPE_KEYS}
        for key, value in (distribution or {}).items():
            if key in normalized:
                normalized[key] = max(0, int(value or 0))
        return normalized

    @staticmethod
    def _normalize_template(doc: Dict[str, Any], template: Dict[str, Any], grade_level: str, subject: Optional[str]) -> Dict[str, Any]:
        return {
            "template_id": template.get("template_id"),
            "paper_type": template.get("paper_type"),
            "paper_type_label": template.get("paper_type_label"),
            "grade_level": template.get("grade_level") or doc.get("grade_level") or grade_level,
            "subject": template.get("subject") or doc.get("subject") or subject,
            "description": template.get("description") or doc.get("description") or "标准试卷模板",
            "total_questions": int(template.get("total_questions") or 20),
            "question_type_distribution": PaperTemplates._normalize_distribution(template.get("question_type_distribution")),
            "difficulty_distribution": template.get("difficulty_distribution") or {"easy": 30, "medium": 50, "hard": 20},
            "time_limit": int(template.get("time_limit") or 90),
            "total_score": int(template.get("total_score") or 100),
            "question_buckets": template.get("question_buckets") or [],
            "knowledge_focus": template.get("knowledge_focus") or [],
            "source_file": doc.get("_source_file"),
        }

    @staticmethod
    def get_template(
        grade_level: str,
        subject: Optional[str] = None,
        paper_type: Optional[str] = None,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """根据学段、科目和试卷场景获取默认模板"""

        resolved_paper_type = PaperTemplates.infer_paper_type(title=title, paper_type=paper_type)
        document = PaperTemplates._pick_document(grade_level, subject)
        template = PaperTemplates._pick_template_entry(document, resolved_paper_type)
        return PaperTemplates._normalize_template(document, template, grade_level, subject)

    @staticmethod
    def get_type_name(type_key: str) -> str:
        """获取题型中文名称"""
        return PaperTemplates.TYPE_NAMES.get(type_key, type_key)

    @staticmethod
    def get_all_types() -> Dict[str, str]:
        """获取所有支持的题型"""
        return PaperTemplates.TYPE_NAMES.copy()

    @staticmethod
    def _fallback_documents() -> List[Dict[str, Any]]:
        return [
            {
                "grade_level": "高中",
                "subject": "数学",
                "default_template_id": "fallback-high-math",
                "templates": [
                    {
                        "template_id": "fallback-high-math",
                        "paper_type": "comprehensive_review",
                        "paper_type_label": "综合复习卷",
                        "description": "高中数学通用综合卷，适合作为未命中 JSON 模板时的安全回退。",
                        "total_questions": 22,
                        "time_limit": 120,
                        "total_score": 150,
                        "difficulty_distribution": {"easy": 25, "medium": 50, "hard": 25},
                        "question_type_distribution": {
                            "choice": 8,
                            "multiple_choice": 4,
                            "fill": 4,
                            "calculation": 4,
                            "comprehensive": 2,
                        },
                    }
                ],
            },
            {
                "grade_level": "高中",
                "subject": "语文",
                "default_template_id": "fallback-high-chinese",
                "templates": [
                    {
                        "template_id": "fallback-high-chinese",
                        "paper_type": "comprehensive_review",
                        "paper_type_label": "综合复习卷",
                        "description": "高中语文通用综合卷回退模板。",
                        "total_questions": 20,
                        "time_limit": 150,
                        "total_score": 150,
                        "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                        "question_type_distribution": {
                            "choice": 10,
                            "fill": 4,
                            "essay": 5,
                            "composition": 1,
                        },
                    }
                ],
            },
            {
                "grade_level": "通用",
                "subject": "通用",
                "default_template_id": "fallback-general",
                "templates": [
                    {
                        "template_id": "fallback-general",
                        "paper_type": "comprehensive_review",
                        "paper_type_label": "综合复习卷",
                        "description": "通用回退模板，适合未覆盖学科的基础组卷。",
                        "total_questions": 20,
                        "time_limit": 90,
                        "total_score": 100,
                        "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
                        "question_type_distribution": {
                            "choice": 10,
                            "fill": 4,
                            "essay": 4,
                            "comprehensive": 2,
                        },
                    }
                ],
            },
        ]
