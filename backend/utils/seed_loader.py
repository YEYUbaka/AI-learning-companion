"""
种子数据加载工具
作者：智学伴开发团队
目的：从 .env / 外部文件加载 Prompt 和模型配置默认值
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, List, Optional

from core.config import settings
from core.logger import logger

ENV_VAR_PATTERN = re.compile(r"\$\{([^}]+)\}")


class SeedLoader:
    """负责从配置中解析 Prompt / ModelConfig 种子数据"""

    @staticmethod
    def load_prompt_seed() -> List[dict]:
        """加载 Prompt 种子数据"""
        return SeedLoader._load_seed(
            json_str=settings.PROMPT_SEED_JSON,
            file_path=settings.PROMPT_SEED_PATH,
            seed_type="prompt",
        )

    @staticmethod
    def load_model_seed() -> List[dict]:
        """加载模型配置种子数据"""
        return SeedLoader._load_seed(
            json_str=settings.MODEL_CONFIG_SEED_JSON,
            file_path=settings.MODEL_CONFIG_SEED_PATH,
            seed_type="model_config",
        )

    @staticmethod
    def _load_seed(json_str: Optional[str], file_path: Optional[str], seed_type: str) -> List[dict]:
        """解析 JSON 字符串或文件"""
        data: Optional[List[dict]] = None

        if json_str:
            data = SeedLoader._parse_json(json_str, seed_type)
        elif file_path:
            data = SeedLoader._parse_file(file_path, seed_type)

        if not data:
            return []

        return SeedLoader._resolve_env_placeholders(data)

    @staticmethod
    def _parse_json(content: str, seed_type: str) -> Optional[List[dict]]:
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
            logger.warning("解析 %s 种子数据失败：JSON 根节点必须是数组", seed_type)
        except json.JSONDecodeError as exc:
            logger.error("解析 %s 种子 JSON 失败: %s", seed_type, exc)
        return None

    @staticmethod
    def _parse_file(file_path: str, seed_type: str) -> Optional[List[dict]]:
        try:
            path = Path(file_path)
            if not path.is_absolute():
                path = Path.cwd() / path
            if not path.exists():
                logger.warning("%s 种子文件不存在: %s", seed_type, path)
                return None
            with path.open("r", encoding="utf-8") as fp:
                return SeedLoader._parse_json(fp.read(), seed_type)
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("读取 %s 种子文件失败: %s", seed_type, exc)
            return None

    @staticmethod
    def _resolve_env_placeholders(data: Any):
        """递归替换 ${ENV_VAR} 占位符"""
        if isinstance(data, dict):
            return {key: SeedLoader._resolve_env_placeholders(value) for key, value in data.items()}
        if isinstance(data, list):
            return [SeedLoader._resolve_env_placeholders(item) for item in data]
        if isinstance(data, str):
            return ENV_VAR_PATTERN.sub(lambda match: os.getenv(match.group(1), ""), data)
        return data


__all__ = ["SeedLoader"]

