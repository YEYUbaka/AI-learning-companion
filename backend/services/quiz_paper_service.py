"""
Quiz paper generation service.
"""
from __future__ import annotations

import json
from collections import Counter
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from core.logger import logger
from repositories.paper_template_repo import PaperTemplateRepository
from repositories.question_bank_repo import QuestionBankRepository
from repositories.quiz_paper_repo import QuizPaperRepository
from services.ai_service import AIService
from services.feature_model_config_service import FeatureModelConfigService
from services.question_bank_service import QuestionBankService


DEFAULT_DIFFICULTY = {"easy": 30, "medium": 50, "hard": 20}
DEFAULT_TYPE_DISTRIBUTION = {"choice": 15, "fill": 5}
DEFAULT_TYPE_SCORES = {
    "choice": 5,
    "multiple_choice": 6,
    "fill": 5,
    "judge": 2,
    "essay": 10,
    "calculation": 10,
    "comprehensive": 12,
    "composition": 20,
}
DIFFICULTY_RELAX_ORDER = {
    "easy": ["easy", "medium"],
    "medium": ["medium", "easy", "hard"],
    "hard": ["hard", "medium"],
}


class QuizPaperService:
    @staticmethod
    def _normalize_text_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (list, tuple, set)):
            return " ".join(QuizPaperService._normalize_text_value(item) for item in value if QuizPaperService._normalize_text_value(item)).strip()
        if isinstance(value, dict):
            return " ".join(QuizPaperService._normalize_text_value(item) for item in value.values() if QuizPaperService._normalize_text_value(item)).strip()
        return str(value).strip()

    @staticmethod
    def _has_meaningful_content(value: Any) -> bool:
        return bool(QuizPaperService._normalize_text_value(value))

    @staticmethod
    def _allocate_counts(total: int, distribution: Dict[str, int], keys: List[str]) -> Dict[str, int]:
        normalized = {key: max(0, int(distribution.get(key, 0))) for key in keys}
        percent_sum = sum(normalized.values()) or 1
        allocated = {key: int(total * normalized[key] / percent_sum) for key in keys}
        diff = total - sum(allocated.values())
        for index in range(diff):
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
        if current_total <= 0:
            current_total = len(distribution)
            distribution = {key: 1 for key in distribution}
        scaled = {key: max(0, int(round(total_questions * distribution[key] / current_total))) for key in distribution}
        diff = total_questions - sum(scaled.values())
        keys = list(scaled.keys())
        for index in range(abs(diff)):
            key = keys[index % len(keys)]
            scaled[key] += 1 if diff > 0 else -1
            scaled[key] = max(0, scaled[key])
        return scaled

    @staticmethod
    def _ensure_question_type_scores(
        question_type_scores: Optional[Dict[str, Any]],
        question_type_distribution: Dict[str, int],
        fallback_score: int,
    ) -> Dict[str, int]:
        scores: Dict[str, int] = {}
        for key, count in question_type_distribution.items():
            if count <= 0:
                continue
            raw_value = None if question_type_scores is None else question_type_scores.get(key)
            scores[key] = max(1, int(raw_value or DEFAULT_TYPE_SCORES.get(key, fallback_score) or fallback_score))
        return scores

    @staticmethod
    def build_blueprint(config: Dict[str, Any]) -> Dict[str, Any]:
        total_questions = int(config.get("total_questions") or 20)
        difficulty_distribution = QuizPaperService._allocate_counts(
            total_questions,
            config.get("difficulty_distribution") or DEFAULT_DIFFICULTY,
            ["easy", "medium", "hard"],
        )
        question_type_distribution = QuizPaperService._ensure_question_distribution(
            total_questions,
            config.get("question_type_distribution"),
        )
        fallback_score = max(1, int(round((config.get("total_score") or 100) / max(total_questions, 1))))
        question_type_scores = QuizPaperService._ensure_question_type_scores(
            config.get("question_type_scores"),
            question_type_distribution,
            fallback_score,
        )
        knowledge_points = config.get("knowledge_points") or []
        specs: List[Dict[str, Any]] = []
        difficulty_queue: List[str] = []
        for difficulty, count in difficulty_distribution.items():
            difficulty_queue.extend([difficulty] * count)
        if len(difficulty_queue) < total_questions:
            difficulty_queue.extend(["medium"] * (total_questions - len(difficulty_queue)))
        knowledge_pool = knowledge_points or ["综合能力"]
        index = 0
        for question_type, count in question_type_distribution.items():
            for _ in range(count):
                specs.append(
                    {
                        "question_id": f"Q{index + 1}",
                        "question_type": question_type,
                        "difficulty": difficulty_queue[index % len(difficulty_queue)],
                        "knowledge_points": [knowledge_pool[index % len(knowledge_pool)]],
                        "score": question_type_scores.get(question_type, fallback_score),
                        "estimated_minutes": max(1, int(round((config.get("time_limit") or 60) / total_questions))),
                    }
                )
                index += 1
        return {
            "title": config.get("title") or "自定义试卷",
            "subject": config.get("subject"),
            "grade_level": config.get("grade_level"),
            "mode": config.get("mode") or "teacher",
            "source_policy": config.get("source_policy") or "knowledge_first",
            "review_level": config.get("review_level") or "normal",
            "total_questions": total_questions,
            "time_limit": config.get("time_limit") or 60,
            "total_score": sum(item["score"] for item in specs),
            "knowledge_points": knowledge_points,
            "question_specs": specs,
            "summary": {
                "difficulty_distribution": difficulty_distribution,
                "question_type_distribution": question_type_distribution,
                "question_type_scores": question_type_scores,
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
            raise ValueError("AI did not return JSON")
        start = min(item for item in [start_obj, start_arr] if item != -1)
        end = max(cleaned.rfind("}"), cleaned.rfind("]"))
        if end == -1:
            raise ValueError("AI returned incomplete JSON")
        return json.loads(cleaned[start : end + 1])

    @staticmethod
    def _build_generation_prompt(config: Dict[str, Any], blueprint: Dict[str, Any], specs: List[Dict[str, Any]]) -> str:
        spec_lines = []
        for spec in specs:
            spec_lines.append(
                f"- {spec['question_id']} | type={spec['question_type']} | difficulty={spec['difficulty']} "
                f"| knowledge={','.join(spec.get('knowledge_points') or [])} | score={spec.get('score', 5)}"
            )
        return f"""
请根据以下出题蓝图，仅补齐缺口题目，并以合法 JSON 返回。
要求：
1. 只能输出正式题目，不得把知识库文档标题、目录标题、专题名称直接当作题干。
2. 必须输出完整的题干、答案、解析，客观题提供 options。
3. 所有补题都要标记 source_type=ai_fallback。
4. 只输出 JSON，不要附加解释。

试卷标题：{blueprint['title']}
学段：{blueprint.get('grade_level') or '通用'}
科目：{blueprint.get('subject') or '通用'}
模式：{blueprint['mode']}
知识点：{', '.join(blueprint.get('knowledge_points') or []) or '综合能力'}

缺口规格：
{chr(10).join(spec_lines)}

JSON 格式：
{{
  "questions": [
    {{
      "question_id": "Q1",
      "type": "choice|multiple_choice|fill|judge|essay|calculation|comprehensive|composition",
      "stem": "正式题干",
      "options": ["A. ...", "B. ..."],
      "answer": "标准答案",
      "explanation": "解析",
      "difficulty": "easy|medium|hard",
      "knowledge_points": ["知识点"],
      "source_type": "ai_fallback",
      "quality_score": 80
    }}
  ]
}}
"""

    @staticmethod
    def _fallback_question_from_spec(spec: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
        knowledge = "、".join(spec.get("knowledge_points") or ["综合能力"])
        qtype = spec.get("question_type", "choice")
        answer = "参考答案"
        options: List[str] = []
        if qtype in {"choice", "multiple_choice"}:
            options = ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"]
            answer = "A"
        elif qtype == "judge":
            answer = "正确"
        elif qtype == "fill":
            answer = "填空答案"
        return {
            "question_id": spec.get("question_id") or f"Q{index + 1}",
            "type": qtype,
            "stem": f"围绕“{knowledge}”设计一道{qtype}题。",
            "question": f"围绕“{knowledge}”设计一道{qtype}题。",
            "options": options,
            "answer": answer,
            "explanation": f"该题考查知识点：{knowledge}。",
            "difficulty": spec.get("difficulty", "medium"),
            "knowledge_points": spec.get("knowledge_points") or [],
            "source_type": "ai_fallback",
            "quality_score": 60,
            "points": max(1, int(spec.get("score") or 1)),
            "estimated_minutes": max(1, int(spec.get("estimated_minutes") or 1)),
            "question_images": [],
            "solution_images": [],
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
        provider = FeatureModelConfigService.get_provider_for_feature(db, "paper")
        try:
            result = AIService.call_ai(
                db=db,
                user_prompt=prompt,
                system_prompt_name="paper_question_generation_prompt",
                temperature=0.4 if blueprint["mode"] == "teacher" else 0.7,
                max_tokens=min(6000, 1200 + len(specs) * 700),
                provider=provider,
            )
            payload = QuizPaperService._extract_json_payload(result.get("raw", "") or result.get("text", ""))
            questions = payload.get("questions", payload if isinstance(payload, list) else [])
            if not isinstance(questions, list):
                raise ValueError("AI returned invalid questions payload")
            normalized: List[Dict[str, Any]] = []
            for index, spec in enumerate(specs):
                raw = questions[index] if index < len(questions) and isinstance(questions[index], dict) else {}
                normalized.append(
                    {
                        "question_id": raw.get("question_id") or spec.get("question_id") or f"Q{index + 1}",
                        "type": raw.get("type") or spec.get("question_type", "choice"),
                        "question": raw.get("question") or raw.get("stem") or "",
                        "stem": raw.get("stem") or raw.get("question") or "",
                        "options": raw.get("options") or [],
                        "answer": raw.get("answer") or "",
                        "explanation": raw.get("explanation") or "",
                        "difficulty": raw.get("difficulty") or spec.get("difficulty", "medium"),
                        "knowledge_points": raw.get("knowledge_points") or spec.get("knowledge_points") or [],
                        "source_type": "ai_fallback",
                        "quality_score": int(raw.get("quality_score") or 80),
                        "points": max(1, int(raw.get("points") or spec.get("score") or 1)),
                        "estimated_minutes": max(1, int(raw.get("estimated_minutes") or spec.get("estimated_minutes") or 1)),
                        "question_images": raw.get("question_images") or [],
                        "solution_images": raw.get("solution_images") or [],
                    }
                )
            return normalized
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("AI fallback question generation failed: %s", exc)
            return [QuizPaperService._fallback_question_from_spec(spec, index) for index, spec in enumerate(specs)]

    @staticmethod
    def _clone_bank_item_as_question(item, spec: Dict[str, Any], include_images: bool = True) -> Dict[str, Any]:
        serialized = QuestionBankService.serialize_item(item)
        return {
            "question_id": spec["question_id"],
            "question_bank_item_id": item.id,
            "type": item.question_type,
            "question": item.stem,
            "stem": item.stem,
            "options": item.options or [],
            "answer": item.answer,
            "explanation": item.explanation or "",
            "difficulty": item.difficulty or spec.get("difficulty", "medium"),
            "knowledge_points": item.knowledge_points or spec.get("knowledge_points") or [],
            "source_type": item.source_type or "question_bank",
            "quality_score": 95,
            "points": max(1, int(spec.get("score") or 1)),
            "estimated_minutes": max(1, int(spec.get("estimated_minutes") or 1)),
            "question_images": serialized["question_images"] if include_images else [],
            "solution_images": serialized["solution_images"] if include_images else [],
            "answer_images": serialized["answer_images"] if include_images else [],
        }

    @staticmethod
    def _select_candidates(
        db: Session,
        *,
        blueprint: Dict[str, Any],
        spec: Dict[str, Any],
        used_item_ids: Sequence[int],
        question_bank_filters: Optional[Dict[str, Any]] = None,
    ) -> List[Any]:
        filters = question_bank_filters or {}
        grade_level = filters.get("grade_level") or blueprint.get("grade_level")
        subject = filters.get("subject") or blueprint.get("subject")
        exact_candidates = QuestionBankRepository.pick_candidates(
            db,
            grade_level=grade_level,
            subject=subject,
            question_type=spec.get("question_type"),
            difficulties=[spec.get("difficulty")],
            knowledge_points=spec.get("knowledge_points") or [],
            limit=60,
        )
        exact_candidates = [item for item in exact_candidates if item.id not in used_item_ids]
        if exact_candidates:
            return exact_candidates
        relaxed_difficulties = DIFFICULTY_RELAX_ORDER.get(spec.get("difficulty"), [spec.get("difficulty")])
        relaxed = QuestionBankRepository.pick_candidates(
            db,
            grade_level=grade_level,
            subject=subject,
            question_type=spec.get("question_type"),
            difficulties=relaxed_difficulties,
            knowledge_points=spec.get("knowledge_points") or [],
            limit=60,
        )
        relaxed = [item for item in relaxed if item.id not in used_item_ids]
        if relaxed:
            return relaxed
        broader = QuestionBankRepository.pick_candidates(
            db,
            grade_level=grade_level,
            subject=subject,
            question_type=spec.get("question_type"),
            difficulties=relaxed_difficulties,
            knowledge_points=[],
            limit=60,
        )
        return [item for item in broader if item.id not in used_item_ids]

    @staticmethod
    def _assemble_questions_from_blueprint(
        db: Session,
        config: Dict[str, Any],
        blueprint: Dict[str, Any],
        *,
        allow_ai_fallback: bool,
        include_images: bool,
        question_bank_filters: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
        questions: List[Dict[str, Any]] = []
        missing_specs: List[Dict[str, Any]] = []
        used_item_ids: List[int] = []

        for spec in blueprint["question_specs"]:
            candidates = QuizPaperService._select_candidates(
                db,
                blueprint=blueprint,
                spec=spec,
                used_item_ids=used_item_ids,
                question_bank_filters=question_bank_filters,
            )
            if not candidates:
                missing_specs.append(spec)
                continue
            chosen = candidates[0]
            used_item_ids.append(chosen.id)
            questions.append(QuizPaperService._clone_bank_item_as_question(chosen, spec, include_images=include_images))

        ai_questions: List[Dict[str, Any]] = []
        if missing_specs and allow_ai_fallback:
            ai_questions = QuizPaperService._generate_questions_for_specs(db, config, blueprint, missing_specs)
            questions.extend(ai_questions)

        source_counter = Counter(question.get("source_type") for question in questions if question.get("source_type"))
        source_stats = {
            "local_question_bank": sum(1 for question in questions if question.get("source_type") != "ai_fallback"),
            "ai_fallback": sum(1 for question in questions if question.get("source_type") == "ai_fallback"),
            "by_source_type": dict(source_counter),
        }
        coverage_report = QuizPaperService._build_coverage_report(blueprint, questions)
        missing_requirements = [
            {
                "question_id": spec.get("question_id"),
                "question_type": spec.get("question_type"),
                "difficulty": spec.get("difficulty"),
                "knowledge_points": spec.get("knowledge_points") or [],
                "reason": "question_bank_insufficient" if allow_ai_fallback else "question_bank_insufficient_no_fallback",
            }
            for spec in missing_specs[len(ai_questions):]
        ]
        return questions, source_stats, coverage_report, missing_requirements

    @staticmethod
    def generate_questions_from_blueprint(
        db: Session,
        config: Dict[str, Any],
        blueprint: Dict[str, Any],
        batch_size: int = 8,
    ) -> List[Dict[str, Any]]:
        del batch_size
        questions, _, _, _ = QuizPaperService._assemble_questions_from_blueprint(
            db,
            config,
            blueprint,
            allow_ai_fallback=bool(config.get("allow_ai_fallback", True)),
            include_images=bool(config.get("include_images", True)),
            question_bank_filters=config.get("question_bank_filters"),
        )
        return questions

    @staticmethod
    def _looks_like_title_instead_of_question(stem: str, knowledge_points: Sequence[str]) -> bool:
        normalized = (stem or "").strip()
        if not normalized:
            return False
        title_like = ["全册", "有关", "概念", "知识点", "专题", "章节", "目录"]
        if normalized in set(knowledge_points or []):
            return True
        if "？" not in normalized and "?" not in normalized and len(normalized) <= 30:
            return any(token in normalized for token in title_like)
        return False

    @staticmethod
    def _build_coverage_report(blueprint: Dict[str, Any], questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        requested_points = blueprint.get("knowledge_points") or []
        actual_points = sorted(
            {
                point
                for question in questions
                for point in (question.get("knowledge_points") or [])
                if point
            }
        )
        actual_types = Counter(question.get("type") for question in questions if question.get("type"))
        actual_difficulty = Counter(question.get("difficulty") for question in questions if question.get("difficulty"))
        return {
            "requested_knowledge_points": requested_points,
            "covered_knowledge_points": actual_points,
            "missing_knowledge_points": [point for point in requested_points if point not in actual_points],
            "question_type_distribution": dict(actual_types),
            "difficulty_distribution": dict(actual_difficulty),
        }

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
        coverage_knowledge_points = sorted({point for question in questions for point in (question.get("knowledge_points") or []) if point})

        for question in questions:
            question_id = question.get("question_id")
            stem = QuizPaperService._normalize_text_value(question.get("stem"))
            if not stem:
                warnings.append({"question_id": question_id, "code": "missing_stem", "message": "题干为空"})
            if not QuizPaperService._has_meaningful_content(question.get("answer")):
                warnings.append({"question_id": question_id, "code": "missing_answer", "message": "答案为空"})
            if blueprint["mode"] == "teacher" and not QuizPaperService._has_meaningful_content(question.get("explanation")):
                warnings.append({"question_id": question_id, "code": "missing_explanation", "message": "教师卷要求完整解析"})
            if QuizPaperService._looks_like_title_instead_of_question(stem, blueprint.get("knowledge_points") or []):
                warnings.append({"question_id": question_id, "code": "invalid_title_stem", "message": "题干看起来像知识库标题或专题名称，不能直接作为试题"})
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
            warnings.append({"question_id": None, "code": "duplicate_question", "message": f"检测到 {duplicates} 道重复题"})
        if len(questions) != blueprint["total_questions"]:
            warnings.append(
                {
                    "question_id": None,
                    "code": "question_count_mismatch",
                    "message": f"期望 {blueprint['total_questions']} 题，实际 {len(questions)} 题",
                }
            )

        quality_score = 100
        quality_score -= min(35, duplicates * 12)
        quality_score -= min(40, len([item for item in warnings if item["code"] in {"missing_answer", "missing_stem", "invalid_title_stem"}]) * 10)
        quality_score -= min(20, len([item for item in warnings if item["code"] == "missing_explanation"]) * 5)
        quality_score = max(0, quality_score)

        quality_status = "pass"
        if any(item["code"] in {"missing_answer", "missing_stem", "question_count_mismatch", "invalid_title_stem"} for item in warnings):
            quality_status = "fail" if review_level == "strict" else "warning"
        elif warnings:
            quality_status = "warning"

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
        regenerated_questions = QuizPaperService._generate_questions_for_specs(db, config, blueprint, regenerate_specs)
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
                "source_type": question.get("source_type"),
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
                "source_stats": {"local_question_bank": 0, "ai_fallback": 0, "by_source_type": {}},
                "coverage_report": {
                    "requested_knowledge_points": blueprint.get("knowledge_points") or [],
                    "covered_knowledge_points": [],
                    "missing_knowledge_points": blueprint.get("knowledge_points") or [],
                    "question_type_distribution": {},
                    "difficulty_distribution": {},
                },
                "missing_requirements": [],
            }

        allow_ai_fallback = bool(config.get("allow_ai_fallback", True))
        include_images = bool(config.get("include_images", True))
        questions, source_stats, coverage_report, missing_requirements = QuizPaperService._assemble_questions_from_blueprint(
            db,
            config,
            blueprint,
            allow_ai_fallback=allow_ai_fallback,
            include_images=include_images,
            question_bank_filters=config.get("question_bank_filters"),
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
            question_type_scores=blueprint["summary"].get("question_type_scores"),
            knowledge_points=blueprint.get("knowledge_points"),
            questions=questions,
            answer_key=answer_key,
            source_stats=source_stats,
            coverage_report=coverage_report,
            missing_requirements=missing_requirements,
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
            "regenerated_question_ids": [],
            "source_stats": source_stats,
            "coverage_report": coverage_report,
            "missing_requirements": missing_requirements,
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
            "question_type_scores": paper.question_type_scores or DEFAULT_TYPE_SCORES.copy(),
            "knowledge_points": paper.knowledge_points or [],
            "time_limit": paper.time_limit or 60,
            "total_score": paper.total_score or 100,
            "mode": mode,
            "source_policy": "knowledge_first",
            "review_level": "strict" if mode == "teacher" else "normal",
            "allow_ai_fallback": True,
            "include_images": True,
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
                or [warning["question_id"] for warning in current_report["warnings"] if warning.get("question_id")]
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
                "source_stats": paper.source_stats or {},
                "coverage_report": paper.coverage_report or {},
                "missing_requirements": paper.missing_requirements or [],
            }
        regenerated_question_ids, merged_questions = QuizPaperService.regenerate_failed_questions(
            db,
            config,
            blueprint,
            original_questions,
            target_ids,
        )
        answer_key = QuizPaperService._generate_answer_key(merged_questions)
        source_stats = {
            "local_question_bank": sum(1 for item in merged_questions if item.get("source_type") != "ai_fallback"),
            "ai_fallback": sum(1 for item in merged_questions if item.get("source_type") == "ai_fallback"),
            "by_source_type": dict(Counter(item.get("source_type") for item in merged_questions if item.get("source_type"))),
        }
        coverage_report = QuizPaperService._build_coverage_report(blueprint, merged_questions)
        missing_requirements: List[Dict[str, Any]] = []
        updated_paper = QuizPaperRepository.update_generated_content(
            db,
            paper_id,
            user_id,
            questions=merged_questions,
            answer_key=answer_key,
            total_questions=len(merged_questions),
            source_stats=source_stats,
            coverage_report=coverage_report,
            missing_requirements=missing_requirements,
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
            "source_stats": source_stats,
            "coverage_report": coverage_report,
            "missing_requirements": missing_requirements,
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
            "question_type_scores": paper.question_type_scores or {},
            "knowledge_points": paper.knowledge_points or [],
            "paper_type": paper.paper_type,
            "time_limit": paper.time_limit,
            "total_score": paper.total_score,
            "source_stats": paper.source_stats or {},
            "coverage_report": paper.coverage_report or {},
            "missing_requirements": paper.missing_requirements or [],
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
                "source_stats": paper.source_stats or {},
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
            question_type_scores=template_data.get("question_type_scores"),
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
            "question_type_scores": template.question_type_scores,
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
                "question_type_scores": template.question_type_scores,
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
