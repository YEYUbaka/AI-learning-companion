"""
Agent 工具注册表
"""
from typing import Dict, List, Optional
from utils.agent_tools import (
    BaseTool,
    FileParserTool,
    QuizGeneratorTool,
    LearningMapBuilderTool,
    StudyPlanGeneratorTool,
    WebSearchTool,
    KnowledgeSearchTool
)
from core.logger import logger


class ToolRegistry:
    """工具注册表（单例模式）"""

    _instance = None
    _tools: Dict[str, BaseTool] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_tools()
        return cls._instance

    def _initialize_tools(self):
        """初始化工具"""
        tools = [
            FileParserTool(),
            QuizGeneratorTool(),
            LearningMapBuilderTool(),
            StudyPlanGeneratorTool(),
            WebSearchTool(),
            KnowledgeSearchTool()
        ]

        for tool in tools:
            self._tools[tool.definition.name] = tool
            logger.info(f"注册工具: {tool.definition.name}")

    def register_tool(self, tool: BaseTool):
        """注册新工具"""
        self._tools[tool.definition.name] = tool
        logger.info(f"注册工具: {tool.definition.name}")

    def get_tool(self, tool_name: str) -> Optional[BaseTool]:
        """获取工具"""
        return self._tools.get(tool_name)

    def list_tools(self) -> List[Dict]:
        """列出所有工具"""
        return [
            {
                "name": tool.definition.name,
                "description": tool.definition.description,
                "category": tool.definition.category,
                "parameters": [
                    {
                        "name": p.name,
                        "type": p.type,
                        "description": p.description,
                        "required": p.required,
                        "default": p.default
                    }
                    for p in tool.definition.parameters
                ]
            }
            for tool in self._tools.values()
        ]

    def get_tools_description(self) -> str:
        """生成工具描述（用于 Agent Prompt）"""
        descriptions = []
        for tool in self._tools.values():
            params_desc = ", ".join([
                f"{p.name}({p.type}): {p.description}"
                for p in tool.definition.parameters
            ])
            descriptions.append(
                f"- {tool.definition.name}: {tool.definition.description}\n"
                f"  参数: {params_desc}"
            )
        return "\n\n".join(descriptions)

    def has_tool(self, tool_name: str) -> bool:
        """检查工具是否存在"""
        return tool_name in self._tools
