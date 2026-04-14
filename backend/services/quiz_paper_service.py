"""
试卷组卷服务
"""
import json
import math
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from core.logger import logger
from repositories.paper_template_repo import PaperTemplateRepository
from repositories.quiz_paper_repo import QuizPaperRepository
from services.ai_service import AIService


DEFAULT_DIFFICULTY = {"easy": 30, "medium": 50, "hard": 20}
DEFAULT_TYPE_DISTRIBUTION = {"choice": 15, "fill": 5}


class QuizPaperService:
    """试卷组卷服务类"""

    @staticmethod
    def _normalize_text_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (list, tuple, set)):
            parts = [QuizPaperService._normalize_text_value(item) for item in value]
            return " ".join(part for part in parts if part).strip()
        if isinstance(value, dict):
            parts = [QuizPaperService._normalize_text_value(item) for item in value.values()]
            return " ".join(part for part in parts if part).strip()
        return str(value).strip()

    @staticmethod
    def _has_meaningful_content(value: Any) -> bool:
        if isinstance(value, dict):
            return any(QuizPaperService._has_meaningful_content(item) for item in value.values())
        if isinstance(value, (list, tuple, set)):
            return any(QuizPaperService._has_meaningful_content(item) for item in value)
        return bool(QuizPaperService._normalize_text_value(value))

    @staticmethod
    def _allocate_counts(total: int, distribution: Dict[str, int], keys: List[str]) -> Dict[str, int]:
        normalized = {key: max(0, int(distribution.get(key, 0))) for key in keys}
        percent_sum = sum(normalized.values()) or 1
        allocated = {key: int(total * normalized[key] / percent_sum) for key in keys}
        allocated_total = sum(allocated.values())
        for index in range(total - allocated_total):
            allocated[keys[index % len(keys)]] += 1
        return allocated

    @staticmethod
    def _ensure_question_distribution(total_questions: int, question_type_distribution: Optional[Dict[str, int]]) -> Dict[str, int]:
        distribution = {
            key: int(value)
            for key, value in (question_type_distribution or DEFAULT_TYPE_DISTRIBUTION).items()
            if int(value or 0) > 0
        }
        if not distribution:
            distribution = DEFAULT_TYPE_DISTRIBUTION.copy()

        current_total = sum(distribution.values())
        if current_total == total_questions:
            return distribution

        keys = list(distribution.keys())
        if current_total <= 0:
            base = total_questions // len(keys)
            remainder = total_questions % len(keys)
            return {
                key: base + (1 if index < remainder else 0)
                for index, key in enumerate(keys)
            }

        scaled = {key: max(0, int(round(total_questions * distribution[key] / current_total))) for key in keys}
        diff = total_questions - sum(scaled.values())
        for index in range(abs(diff)):
            key = keys[index % len(keys)]
            scaled[key] += 1 if diff > 0 else -1
            scaled[key] = max(0, scaled[key])
        return scaled

    @staticmethod
    def build_blueprint(config: Dict[str, Any]) -> Dict[str, Any]:
        total_questions = int(config.get("total_questions") or 20)
        difficulty_distribution = QuizPaperService._allocate_counts(
            total_questions,
            config.get("difficulty_distribution") or DEFAULT_DIFFICULTY,
            ["easy", "medium", "hard"],
        )
        question_type_distribution = QuizPaperService._ensure_question_distribution(
            total_questions, config.get("question_type_distribution")
        )
        knowledge_points = config.get("knowledge_points") or []
        mode = config.get("mode") or "teacher"
        source_policy = config.get("source_policy") or "knowledge_first"
        review_level = config.get("review_level") or "normal"

        specs: List[Dict[str, Any]] = []
        difficulty_queue: List[str] = []
        for difficulty, count in difficulty_distribution.items():
            difficulty_queue.extend([difficulty] * count)
        if len(difficulty_queue) < total_questions:
            difficulty_queue.extend(["medium"] * (total_questions - len(difficulty_queue)))

        knowledge_pool = knowledge_points or ["综合能力"]
        spec_index = 0
        for question_type, count in question_type_distribution.items():
            for _ in range(count):
                question_id = f"Q{spec_index + 1}"
                specs.append(
                    {
                        "question_id": question_id,
                        "question_type": question_type,
                        "difficulty": difficulty_queue[spec_index % len(difficulty_queue)],
                        "knowledge_points": [knowledge_pool[spec_index % len(knowledge_pool)]],
                        "score": max(1, int(round((config.get("total_score") or 100) / total_questions))),
                        "estimated_minutes": max(1, int(round((config.get("time_limit") or 60) / total_questions))),
                    }
                )
                spec_index += 1

        return {
            "title": config.get("title") or "自定义试卷",
            "subject": config.get("subject"),
            "grade_level": config.get("grade_level"),
            "mode": mode,
            "source_policy": source_policy,
            "review_level": review_level,
            "total_questions": total_questions,
            "time_limit": config.get("time_limit") or 60,
            "total_score": config.get("total_score") or 100,
            "knowledge_points": knowledge_points,
            "question_specs": specs,
            "summary": {
                "difficulty_distribution": difficulty_distribution,
                "question_type_distribution": question_type_distribution,
                "knowledge_points": knowledge_points,
            },
        }

    @staticmethod
    def _extract_json_payload(text: str) -> Any:
        cleaned = (text or "").strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        start_obj = cleaned.find("{")
        start_arr = cleaned.find("[")
        if start_obj == -1 and start_arr == -1:
            raise ValueError("AI 未返回 JSON")
        start = min(item for item in [start_obj, start_arr] if item != -1)
        end = max(cleaned.rfind("}"), cleaned.rfind("]"))
        if end == -1:
            raise ValueError("AI 返回 JSON 不完整")
        payload = json.loads(cleaned[start : end + 1])
        return payload

    @staticmethod
    def _build_generation_prompt(config: Dict[str, Any], blueprint: Dict[str, Any], specs: List[Dict[str, Any]]) -> str:
        spec_lines = []
        for spec in specs:
            spec_lines.append(
                f"- {spec['question_id']} | type={spec['question_type']} | difficulty={spec['difficulty']} "
                f"| knowledge={','.join(spec['knowledge_points'])} | score={spec['score']}"
            )

        return f"""
请根据试卷蓝图生成题目，只输出合法 JSON。

模式：{blueprint['mode']}
科目：{blueprint.get('subject') or '通用'}
学段：{blueprint.get('grade_level') or '通用'}
来源策略：{blueprint['source_policy']}
审核级别：{blueprint['review_level']}

题目规格：
{chr(10).join(spec_lines)}

输出结构：
{{
  "questions": [
    {{
      "question_id": "Q1",
      "type": "choice|fill|judge|essay|calculation|comprehensive|composition|multiple_choice",
      "stem": "题干",
      "options": ["A. ...", "B. ..."],
      "answer": "标准答案",
      "explanation": "解析",
      "difficulty": "easy|medium|hard",
      "knowledge_points": ["知识点"],
      "source_type": "knowledge_base|example_bank|ai_generated",
      "quality_score": 0
    }}
  ]
}}

要求：
1. 必须严格覆盖给定规格，question_id 不能变。
2. teacher 模式要求题干规范、解析完整；practice 模式允许更灵活但仍需完整答案。
3. source_policy=knowledge_first 时，优先使用知识库/样题风格；确无证据时 source_type 可标记为 ai_generated。
4. 不要输出 JSON 之外的任何说明。
"""

    @staticmethod
    def _fallback_question_from_spec(spec: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        knowledge = "、".join(spec.get("knowledge_points") or ["综合能力"])
        qtype = spec["question_type"]
        stem = f"围绕“{knowledge}”生成的{qtype}题（{spec['difficulty']}）"
        options = []
        answer = "参考答案"
        if qtype in {"choice", "multiple_choice"}:
            options = ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"]
            answer = "A"
        elif qtype == "judge":
            answer = "正确"
        elif qtype == "fill":
            answer = "填空答案"

        return {
            "question_id": spec["question_id"],
            "type": qtype,
            "stem": stem,
            "options": options,
            "answer": answer,
            "explanation": f"该题对应知识点：{knowledge}。",
            "difficulty": spec["difficulty"],
            "knowledge_points": spec.get("knowledge_points") or [],
            "source_type": "ai_generated",
            "quality_score": 60,
        }

    @staticmethod
    def _generate_questions_for_specs(
        db: Session,
        config: Dict[str, Any],
        blueprint: Dict[str, Any],
        specs: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        if not specs:
            return []

        prompt = QuizPaperService._build_generation_prompt(config, blueprint, specs)
        try:
            result = AIService.call_ai(
                db=db,
                user_prompt=prompt,
                system_prompt_name="quiz_generator_prompt",
                temperature=0.4 if blueprint["mode"] == "teacher" else 0.7,
                max_tokens=min(6000, 1200 + len(specs) * 700),
            )
            payload = QuizPaperService._extract_json_payload(result.get("raw", "") or result.get("text", ""))
            questions = payload.get("questions", payload if isinstance(payload, list) else [])
            if not isinstance(questions, list):
                raise ValueError("AI 返回的 questions 结构不合法")
            normalized = []
            for index, spec in enumerate(specs):
                raw = questions[index] if index < len(questions) and isinstance(questions[index], dict) else {}
                normalized.append(
                    {
                        "question_id": raw.get("question_id") or spec["question_id"],
                        "type": raw.get("type") or spec["question_type"],
                        "stem": raw.get("stem") or raw.get("question") or f"{spec['question_type']}题",
                        "options": raw.get("options") or [],
                        "answer": raw.get("answer") or "",
                        "explanation": raw.get("explanation") or "",
                        "difficulty": raw.get("difficulty") or spec["difficulty"],
                        "knowledge_points": raw.get("knowledge_points") or spec.get("knowledge_points") or [],
                        "source_type": raw.get("source_type") or ("knowledge_base" if blueprint["source_policy"] == "knowledge_first" else "ai_generated"),
                        "quality_score": int(raw.get("quality_score") or 75),
                    }
                )
            return normalized
        except Exception as exc:
            logger.warning("AI 题目生成失败，使用兜底题目: %s", exc)
            return [QuizPaperService._fallback_question_from_spec(spec, config) for spec in specs]

    @staticmethod
    def generate_questions_from_blueprint(
        db: Session,
        config: Dict[str, Any],
        blueprint: Dict[str, Any],
        batch_size: int = 5,
    ) -> List[Dict[str, Any]]:
        specs = blueprint["question_specs"]
        generated: List[Dict[str, Any]] = []
        for index in range(0, len(specs), batch_size):
            batch_specs = specs[index : index + batch_size]
            generated.extend(
                QuizPaperService._generate_questions_for_specs(db, config, blueprint, batch_specs)
            )
        return generated

    @staticmethod
    def review_generated_paper(
        blueprint: Dict[str, Any],
        questions: List[Dict[str, Any]],
        review_level: str = "normal",
    ) -> Dict[str, Any]:
        warnings: List[Dict[str, Any]] = []
        stems = [QuizPaperService._normalize_text_value(question.get("stem")) for question in questions]
        non_empty_stems = [stem for stem in stems if stem]
        duplicates = len(non_empty_stems) - len(set(non_empty_stems))
        duplicate_rate = duplicates / len(non_empty_stems) if non_empty_stems else 0

        expected_specs = {spec["question_id"]: spec for spec in blueprint["question_specs"]}
        actual_type_distribution = Counter(question.get("type") for question in questions if question.get("type"))
        actual_difficulty_distribution = Counter(question.get("difficulty") for question in questions if question.get("difficulty"))
        coverage_knowledge_points = sorted(
            {
                point
                for question in questions
                for point in (question.get("knowledge_points") or [])
                if point
            }
        )

        for question in questions:
            question_id = question.get("question_id")
            stem = QuizPaperService._normalize_text_value(question.get("stem"))
            if not stem:
                warnings.append({"question_id": question_id, "code": "missing_stem", "message": "题干为空"})
            if not QuizPaperService._has_meaningful_content(question.get("answer")):
                warnings.append({"question_id": question_id, "code": "missing_answer", "message": "答案为空"})
            if blueprint["mode"] == "teacher" and not QuizPaperService._has_meaningful_content(question.get("explanation")):
                warnings.append({"question_id": question_id, "code": "missing_explanation", "message": "教师卷要求完整解析"})
            expected_spec = expected_specs.get(question_id)
            if expected_spec and question.get("difficulty") != expected_spec["difficulty"]:
                warnings.append(
                    {
                        "question_id": question_id,
                        "code": "difficulty_mismatch",
                        "message": f"期望难度 {expected_spec['difficulty']}，实际为 {question.get('difficulty')}",
                    }
                )

        if duplicates > 0:
            warnings.append(
                {
                    "question_id": None,
                    "code": "duplicate_question",
                    "message": f"检测到 {duplicates} 道重复题",
                }
            )
        if len(questions) != blueprint["total_questions"]:
            warnings.append(
                {
                    "question_id": None,
                    "code": "question_count_mismatch",
                    "message": f"期望 {blueprint['total_questions']} 道，实际 {len(questions)} 道",
                }
            )

        quality_score = 100
        quality_score -= min(35, duplicates * 12)
        quality_score -= min(40, len([item for item in warnings if item["code"] in {"missing_answer", "missing_stem"}]) * 10)
        quality_score -= min(20, len([item for item in warnings if item["code"] == "missing_explanation"]) * 5)
        quality_score = max(0, quality_score)

        if any(item["code"] in {"missing_answer", "missing_stem", "question_count_mismatch"} for item in warnings):
            quality_status = "fail" if review_level == "strict" else "warning"
        elif warnings:
            quality_status = "warning"
        else:
            quality_status = "pass"

        if blueprint["source_policy"] == "knowledge_first" and not any(
            question.get("source_type") in {"knowledge_base", "example_bank"} for question in questions
        ):
            warnings.append(
                {
                    "question_id": None,
                    "code": "no_knowledge_evidence",
                    "message": "本次组卷未命中知识库证据，当前题目主要来自 AI 生成。",
                }
            )
            if quality_status == "pass":
                quality_status = "warning"
            quality_score = max(0, quality_score - 10)

        return {
            "quality_status": quality_status,
            "score": quality_score,
            "duplicate_rate": round(duplicate_rate, 4),
            "coverage_knowledge_points": coverage_knowledge_points,
            "warnings": warnings,
            "stats": {
                "generated_questions": len(questions),
                "expected_questions": blueprint["total_questions"],
                "type_distribution": dict(actual_type_distribution),
                "difficulty_distribution": dict(actual_difficulty_distribution),
            },
        }

    @staticmethod
    def regenerate_failed_questions(
        db: Session,
        config: Dict[str, Any],
        blueprint: Dict[str, Any],
        original_questions: List[Dict[str, Any]],
        failed_question_ids: List[str],
    ) -> Tuple[List[str], List[Dict[str, Any]]]:
        spec_map = {spec["question_id"]: spec for spec in blueprint["question_specs"]}
        regenerate_specs = [spec_map[item] for item in failed_question_ids if item in spec_map]
        regenerated_questions = QuizPaperService._generate_questions_for_specs(
            db,
            config,
            blueprint,
            regenerate_specs,
        )
        regenerated_map = {question["question_id"]: question for question in regenerated_questions}
        merged = [regenerated_map.get(question["question_id"], question) for question in original_questions]
        return failed_question_ids, merged

    @staticmethod
    def _generate_answer_key(questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "question_id": question.get("question_id"),
                "answer": question.get("answer"),
                "knowledge_points": question.get("knowledge_points") or [],
            }
            for question in questions
        ]

    @staticmethod
    def generate_custom_paper(
        db: Session,
        user_id: int,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        blueprint = QuizPaperService.build_blueprint(config)
        if config.get("blueprint_only"):
            return {
                "success": True,
                "blueprint": blueprint,
                "quality_report": None,
                "regenerated_question_ids": [],
                "questions": [],
            }

        questions = QuizPaperService.generate_questions_from_blueprint(db, config, blueprint)
        quality_report = QuizPaperService.review_generated_paper(
            blueprint=blueprint,
            questions=questions,
            review_level=blueprint["review_level"],
        )
        failed_question_ids = sorted(
            {
                item["question_id"]
                for item in quality_report["warnings"]
                if item.get("question_id")
            }
        )
        regenerated_question_ids: List[str] = []
        if failed_question_ids:
            regenerated_question_ids, questions = QuizPaperService.regenerate_failed_questions(
                db=db,
                config=config,
                blueprint=blueprint,
                original_questions=questions,
                failed_question_ids=failed_question_ids,
            )
            quality_report = QuizPaperService.review_generated_paper(
                blueprint=blueprint,
                questions=questions,
                review_level=blueprint["review_level"],
            )

        answer_key = QuizPaperService._generate_answer_key(questions)
        paper = QuizPaperRepository.create(
            db=db,
            user_id=user_id,
            title=blueprint["title"],
            subject=blueprint.get("subject"),
            grade_level=blueprint.get("grade_level"),
            total_questions=len(questions),
            difficulty_distribution=blueprint["summary"]["difficulty_distribution"],
            question_type_distribution=blueprint["summary"]["question_type_distribution"],
            knowledge_points=blueprint.get("knowledge_points"),
            questions=questions,
            answer_key=answer_key,
            paper_type=blueprint["mode"],
            time_limit=blueprint["time_limit"],
            total_score=blueprint["total_score"],
        )
        return {
            "success": True,
            "paper_id": paper.id,
            "title": paper.title,
            "questions": questions,
            "answer_key": answer_key,
            "total_questions": len(questions),
            "total_score": paper.total_score,
            "blueprint": blueprint,
            "quality_report": quality_report,
            "regenerated_question_ids": regenerated_question_ids,
        }

    @staticmethod
    def _build_config_from_paper(paper) -> Dict[str, Any]:
        mode = paper.paper_type or "teacher"
        return {
            "title": paper.title,
            "subject": paper.subject,
            "grade_level": paper.grade_level,
            "total_questions": paper.total_questions,
            "difficulty_distribution": paper.difficulty_distribution or DEFAULT_DIFFICULTY.copy(),
            "question_type_distribution": paper.question_type_distribution or DEFAULT_TYPE_DISTRIBUTION.copy(),
            "knowledge_points": paper.knowledge_points or [],
            "time_limit": paper.time_limit or 60,
            "total_score": paper.total_score or 100,
            "mode": mode,
            "source_policy": "knowledge_first",
            "review_level": "strict" if mode == "teacher" else "normal",
        }

    @staticmethod
    def regenerate_paper_questions(
        db: Session,
        paper_id: int,
        user_id: int,
        question_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        paper = QuizPaperRepository.get_by_id(db, paper_id, user_id)
        if not paper:
            raise ValueError("试卷不存在或无权访问")

        config = QuizPaperService._build_config_from_paper(paper)
        blueprint = QuizPaperService.build_blueprint(config)
        original_questions = paper.questions or []
        current_report = QuizPaperService.review_generated_paper(
            blueprint=blueprint,
            questions=original_questions,
            review_level=blueprint["review_level"],
        )

        target_ids = sorted(
            set(
                question_ids
                or [
                    item["question_id"]
                    for item in current_report["warnings"]
                    if item.get("question_id")
                ]
            )
        )

        if not target_ids:
            return {
                "success": True,
                "paper_id": paper.id,
                "title": paper.title,
                "questions": original_questions,
                "answer_key": paper.answer_key or [],
                "total_questions": paper.total_questions,
                "total_score": paper.total_score,
                "blueprint": blueprint,
                "quality_report": current_report,
                "regenerated_question_ids": [],
            }

        regenerated_question_ids, merged_questions = QuizPaperService.regenerate_failed_questions(
            db,
            config,
            blueprint,
            original_questions,
            target_ids,
        )
        answer_key = QuizPaperService._generate_answer_key(merged_questions)
        updated_paper = QuizPaperRepository.update_generated_content(
            db,
            paper_id,
            user_id,
            questions=merged_questions,
            answer_key=answer_key,
            total_questions=len(merged_questions),
        )
        if not updated_paper:
            raise ValueError("试卷更新失败")

        quality_report = QuizPaperService.review_generated_paper(
            blueprint=blueprint,
            questions=merged_questions,
            review_level=blueprint["review_level"],
        )
        return {
            "success": True,
            "paper_id": updated_paper.id,
            "title": updated_paper.title,
            "questions": merged_questions,
            "answer_key": answer_key,
            "total_questions": len(merged_questions),
            "total_score": updated_paper.total_score,
            "blueprint": blueprint,
            "quality_report": quality_report,
            "regenerated_question_ids": regenerated_question_ids,
        }

    @staticmethod
    def get_paper(db: Session, paper_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        paper = QuizPaperRepository.get_by_id(db, paper_id, user_id)
        if not paper:
            return None
        return {
            "id": paper.id,
            "title": paper.title,
            "subject": paper.subject,
            "grade_level": paper.grade_level,
            "questions": paper.questions or [],
            "answer_key": paper.answer_key or [],
            "total_questions": paper.total_questions,
            "difficulty_distribution": paper.difficulty_distribution or {},
            "question_type_distribution": paper.question_type_distribution or {},
            "knowledge_points": paper.knowledge_points or [],
            "paper_type": paper.paper_type,
            "time_limit": paper.time_limit,
            "total_score": paper.total_score,
            "created_at": paper.created_at.isoformat() if paper.created_at else None,
        }

    @staticmethod
    def list_papers(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        papers = QuizPaperRepository.list_by_user(db, user_id, skip, limit)
        return [
            {
                "id": paper.id,
                "title": paper.title,
                "subject": paper.subject,
                "grade_level": paper.grade_level,
                "paper_type": paper.paper_type,
                "total_questions": paper.total_questions,
                "total_score": paper.total_score,
                "time_limit": paper.time_limit,
                "created_at": paper.created_at.isoformat() if paper.created_at else None,
            }
            for paper in papers
        ]

    @staticmethod
    def delete_paper(db: Session, paper_id: int, user_id: int) -> bool:
        return QuizPaperRepository.delete(db, paper_id, user_id)

    @staticmethod
    def save_template(db: Session, user_id: int, template_data: Dict[str, Any]) -> Dict[str, Any]:
        template = PaperTemplateRepository.create(
            db=db,
            user_id=user_id,
            name=template_data["name"],
            description=template_data.get("description"),
            paper_title=template_data.get("paper_title"),
            subject=template_data.get("subject"),
            grade_level=template_data.get("grade_level"),
            total_questions=template_data.get("total_questions", 20),
            difficulty_distribution=template_data.get("difficulty_distribution"),
            question_type_distribution=template_data.get("question_type_distribution"),
            knowledge_points=template_data.get("knowledge_points"),
            time_limit=template_data.get("time_limit"),
            total_score=template_data.get("total_score", 100),
        )
        return {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "paper_title": template.paper_title,
            "subject": template.subject,
            "grade_level": template.grade_level,
            "total_questions": template.total_questions,
            "difficulty_distribution": template.difficulty_distribution,
            "question_type_distribution": template.question_type_distribution,
            "knowledge_points": template.knowledge_points,
            "time_limit": template.time_limit,
            "total_score": template.total_score,
            "usage_count": template.usage_count or 0,
            "created_at": template.created_at.isoformat() if template.created_at else None,
        }

    @staticmethod
    def list_templates(db: Session, user_id: int) -> List[Dict[str, Any]]:
        templates = PaperTemplateRepository.list_by_user(db, user_id)
        return [
            {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "paper_title": template.paper_title,
                "subject": template.subject,
                "grade_level": template.grade_level,
                "total_questions": template.total_questions,
                "difficulty_distribution": template.difficulty_distribution,
                "question_type_distribution": template.question_type_distribution,
                "knowledge_points": template.knowledge_points,
                "time_limit": template.time_limit,
                "total_score": template.total_score,
                "usage_count": template.usage_count or 0,
                "created_at": template.created_at.isoformat() if template.created_at else None,
            }
            for template in templates
        ]

    @staticmethod
    def delete_template(db: Session, template_id: int, user_id: int) -> Dict[str, Any]:
        success = PaperTemplateRepository.delete(db, template_id, user_id)
        if not success:
            raise ValueError("模板不存在或无权删除")
        return {"success": True, "message": "模板删除成功"}
