"""
结构化 Agent 执行器测试
"""
from services.agent_executor import AgentPlanner
from utils.tool_registry import ToolRegistry


def test_tool_registry_exposes_structured_tool_metadata():
    registry = ToolRegistry()
    tool = registry.get_tool("build_paper_blueprint")

    assert tool is not None
    assert "paper_generation" in tool.definition.intent_tags
    assert "type" in tool.definition.output_schema
    assert tool.definition.fallback_policy


def test_planner_routes_education_query_to_evidence_tools_first():
    planner = AgentPlanner(ToolRegistry())
    plan = planner.plan("请讲解牛顿第二定律，并给我两道例题和对应考点")

    tool_names = [item["tool_name"] for item in plan["tool_steps"]]
    assert tool_names[0] == "search_knowledge"
    assert "search_example_questions" in tool_names
    assert plan["quality_status"] == "planned"


def test_planner_routes_paper_request_to_blueprint_then_generation():
    planner = AgentPlanner(ToolRegistry())
    plan = planner.plan("帮我生成一份高中数学教师卷，主题是函数与导数，6道题")

    tool_names = [item["tool_name"] for item in plan["tool_steps"]]
    assert tool_names[:3] == [
        "build_paper_blueprint",
        "generate_paper_questions",
        "review_paper_quality",
    ]


def test_planner_does_not_route_uploaded_paper_question_to_generation():
    planner = AgentPlanner(ToolRegistry())
    plan = planner.plan("请解答上传的试卷第 3 题，并讲清楚里面的公式")

    tool_names = [item["tool_name"] for item in plan["tool_steps"]]

    assert "build_paper_blueprint" not in tool_names
    assert "generate_paper_questions" not in tool_names


def test_planner_routes_java_learning_path_to_study_plan():
    planner = AgentPlanner(ToolRegistry())
    plan = planner.plan("帮我推荐一个能够达到面试程度的Java学习路径")

    tool_names = [item["tool_name"] for item in plan["tool_steps"]]
    assert tool_names == ["search_knowledge", "generate_study_plan"]


def test_planner_routes_resource_recommendation_to_web_search():
    planner = AgentPlanner(ToolRegistry())
    plan = planner.plan("推荐几个好的高数up主")

    tool_names = [item["tool_name"] for item in plan["tool_steps"]]
    assert tool_names == ["web_search"]
