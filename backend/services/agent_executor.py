"""
Agent 执行引擎 - 实现 ReAct 推理循环
"""
import json
import re
import time
import asyncio
from typing import Dict, Any, Optional, List, AsyncGenerator
from sqlalchemy.orm import Session
from repositories.agent_repo import AgentRepository
from utils.tool_registry import ToolRegistry
from core.logger import logger


class AgentExecutor:
    """Agent 执行引擎"""

    def __init__(self, db: Session, user_id: int, session_id: int):
        self.db = db
        self.user_id = user_id
        self.session_id = session_id
        self.tool_registry = ToolRegistry()
        self.max_iterations = 10  # 最大迭代次数
        self.current_iteration = 0

        # 去重机制：记录已执行的响应
        self.response_history = []  # 存储最近的响应内容
        self.max_history_size = 5  # 最多保留最近 5 个响应用于去重

        # 加载模型配置
        from utils.model_registry import registry
        registry.load_from_db(db)

    async def execute_react(self, goal: str) -> Dict[str, Any]:
        """执行 ReAct 推理循环"""
        try:
            logger.info(f"开始执行 ReAct 任务: {goal}")

            # 构建 ReAct Prompt
            system_prompt = self._build_react_prompt()

            # 记录初始步骤
            AgentRepository.add_step(
                self.db,
                session_id=self.session_id,
                step_number=0,
                step_type="goal",
                content=goal
            )

            final_answer = None
            step_number = 1
            conversation_history = []  # 对话历史

            # ReAct 循环
            while self.current_iteration < self.max_iterations:
                self.current_iteration += 1
                logger.info(f"ReAct 迭代 {self.current_iteration}/{self.max_iterations}")

                # 调用 AI 生成下一步（使用 registry）
                from utils.model_registry import registry

                messages = [{"role": "system", "content": system_prompt}]

                # 第一轮：添加任务目标 + 关键词强制提示
                if self.current_iteration == 1:
                    # 检测关键词并添加强制提示
                    keyword_hint = self._detect_keyword_and_hint(goal)
                    user_message = f"任务目标: {goal}\n\n{keyword_hint}请开始思考并执行。"
                    messages.append({"role": "user", "content": user_message})
                else:
                    # 后续轮次：添加历史对话
                    for msg in conversation_history:
                        messages.append(msg)

                response = registry.call_with_fallback(
                    messages=messages,
                    temperature=0.1,  # 降低到 0.1，提高稳定性和格式遵守度
                    max_tokens=2000
                )

                ai_response = response.get("text", "")
                logger.info(f"AI 响应: {ai_response[:200]}...")

                # 检测重复响应
                if self._is_duplicate_response(ai_response):
                    logger.warning("检测到重复响应，提示 AI 重新思考")
                    conversation_history.append({"role": "assistant", "content": ai_response})
                    conversation_history.append({
                        "role": "user",
                        "content": "你刚才的回答与之前重复了，请重新思考并尝试不同的方法。"
                    })
                    continue

                # 解析响应
                parsed = self._parse_react_response(ai_response)

                if parsed["type"] == "final_answer":
                    # 找到最终答案
                    final_answer = parsed["content"]
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="final_answer",
                        content=final_answer
                    )
                    break

                elif parsed["type"] == "thought":
                    # 检测是否只有 Thought 而没有 Action（这是错误的）
                    thought_content = parsed["content"].lower()
                    if any(keyword in thought_content for keyword in ["需要调用", "应该调用", "调用工具", "使用工具"]):
                        # AI 说要调用工具但没有实际调用，强制提示
                        logger.warning(f"检测到 AI 只说要调用工具但没有实际输出 Action: {parsed['content'][:100]}")

                        # 记录这个错误的 Thought
                        AgentRepository.add_step(
                            self.db,
                            session_id=self.session_id,
                            step_number=step_number,
                            step_type="thought",
                            content=parsed["content"]
                        )
                        step_number += 1

                        # 强制提示 AI 必须输出 Action
                        conversation_history.append({"role": "assistant", "content": ai_response})
                        conversation_history.append({
                            "role": "user",
                            "content": "❌ 错误：你只说了要调用工具，但没有实际输出 Action 和 Action Input。\n\n请立即按照以下格式输出：\nAction: [工具名]\nAction Input: {\"参数\": \"值\"}\n\n不要再只说 Thought，必须实际调用工具！"
                        })
                        continue

                    # 正常的 Thought（不包含"需要调用"等关键词）
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="thought",
                        content=parsed["content"]
                    )
                    step_number += 1

                    # 将 AI 响应加入对话历史
                    conversation_history.append({"role": "assistant", "content": ai_response})

                elif parsed["type"] == "action":
                    # 记录行动步骤
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="action",
                        content=f"{parsed['tool_name']}: {json.dumps(parsed['tool_input'], ensure_ascii=False)}"
                    )
                    step_number += 1

                    # 执行工具调用
                    observation = await self._execute_tool(
                        parsed["tool_name"],
                        parsed["tool_input"]
                    )

                    # 记录观察结果
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="observation",
                        content=json.dumps(observation, ensure_ascii=False)
                    )
                    step_number += 1

                    # 将观察结果加入对话历史
                    observation_text = f"Observation: {json.dumps(observation, ensure_ascii=False)}"
                    conversation_history.append({"role": "assistant", "content": ai_response})
                    conversation_history.append({"role": "user", "content": observation_text})

                else:
                    # 无法解析，记录错误
                    logger.warning(f"无法解析 AI 响应: {ai_response}")
                    conversation_history.append({"role": "assistant", "content": ai_response})
                    conversation_history.append({"role": "user", "content": "请按照 Thought/Action/Final Answer 格式继续"})

            # 更新会话状态
            if final_answer:
                AgentRepository.update_session_status(
                    self.db,
                    session_id=self.session_id,
                    status="completed"
                )
                return {
                    "success": True,
                    "answer": final_answer,
                    "iterations": self.current_iteration
                }
            else:
                AgentRepository.update_session_status(
                    self.db,
                    session_id=self.session_id,
                    status="failed"
                )
                return {
                    "success": False,
                    "error": "达到最大迭代次数，未找到最终答案",
                    "iterations": self.current_iteration
                }

        except Exception as e:
            logger.error(f"ReAct 执行失败: {str(e)}")
            AgentRepository.update_session_status(
                self.db,
                session_id=self.session_id,
                status="failed"
            )
            return {
                "success": False,
                "error": str(e)
            }

    def _build_react_prompt(self) -> str:
        """构建 ReAct Prompt"""
        # 获取工具描述
        tools_desc = self.tool_registry.get_tools_description()

        # 使用默认 ReAct Prompt
        base_prompt = """你是一个智能学习助手 Agent。

【核心规则 - 违反将立即失败】
1. 禁止只说"我需要调用XX工具"而不实际调用
2. 必须输出 Action: 和 Action Input: 才算调用工具
3. 每次回复只能是以下两种格式之一，不允许其他格式

【格式 A：调用工具（必须同时包含 Thought、Action、Action Input）】
Thought: [简短思考，不超过20字]
Action: [工具名称]
Action Input: {"参数名": "参数值"}

【格式 B：给出最终答案】
Thought: [确认已完成]
Final Answer: [详细答案]

【正确示例 - 必须模仿】

示例 1：用户要学习计划
Thought: 调用学习计划工具
Action: generate_study_plan
Action Input: {"goal": "Python学习", "duration_days": 7}

示例 2：用户要搜索资料
Thought: 调用搜索工具
Action: web_search
Action Input: {"query": "Python教程", "max_results": 5}

示例 3：用户要测验题目
Thought: 调用测验工具
Action: generate_quiz
Action Input: {"topic": "Python基础", "num_questions": 5, "difficulty": "medium"}

【错误示例 - 禁止模仿】
❌ 错误：Thought: 我需要调用generate_study_plan工具来生成学习计划
   （只有 Thought，没有 Action 和 Action Input）

❌ 错误：Thought: 用户需要学习计划
   （只有 Thought，什么都不做）

❌ 错误：Thought: 应该调用工具
   Action:
   （Action 为空）

【重要提醒】
- 如果你只输出 Thought 而没有 Action，系统会认为你在偷懒
- 必须在同一次回复中输出 Thought + Action + Action Input
- 不要分多次输出，一次性输出完整格式

【工具列表】
- generate_study_plan: 生成学习计划（参数：goal, duration_days）
- generate_quiz: 生成测验题目（参数：topic, num_questions, difficulty）
- build_learning_map: 构建知识图谱（参数：content, title）
- web_search: 网络搜索（参数：query, max_results）
- parse_file: 解析文件（参数：file_path）- 仅当用户明确上传文件时使用
- search_knowledge: 语义搜索本地知识库（参数：query, limit, grade_level, subject）

【关键词触发规则 - 必须严格遵守】
⚠️ 当用户输入包含以下关键词时，必须调用对应工具，禁止直接回答：

1. "搜索"、"查找"、"找一下"、"搜一下" → 必须调用 web_search
   示例：用户说"搜索Python教程" → Action: web_search

2. "学习计划"、"学习路线"、"怎么学" → 必须调用 generate_study_plan
   示例：用户说"Python怎么学" → Action: generate_study_plan

3. "出题"、"测验"、"练习题"、"题目" → 必须调用 generate_quiz
   示例：用户说"出几道题" → Action: generate_quiz

4. "知识图谱"、"知识结构"、"思维导图" → 必须调用 build_learning_map
   示例：用户说"画个知识图谱" → Action: build_learning_map

5. "知识点"、"概念"、"定义"、"公式"、"原理"、"例题"、"真题"、"考点" → 必须先调用 search_knowledge
   示例：用户说"分数加减法的知识点" → Action: search_knowledge

⚠️ 特别强调：
- 用户说"搜索XX"时，绝对不能直接回答你知道的内容
- 必须调用 web_search 工具获取最新的网络资料
- 搜索结果必须包含可点击的链接（Markdown格式）

Final Answer 格式要求：
- 使用 Markdown 格式输出
- 包含标题、列表、表格等结构化元素
- 内容要详细、具体、有实际价值
- 如果是学习计划，要包含每日任务和时间安排
- 如果是测验题目，要包含题目、选项、答案和解析
- 如果是知识图谱，要描述知识点之间的关系
- **如果包含网络搜索结果，必须使用 Markdown 链接格式 [链接文本](URL)，让用户可以直接点击访问**
- **所有 URL 都必须转换为可点击的链接，格式：[点击访问](URL)**

示例 Final Answer 格式：

## 搜索结果示例
根据搜索结果，我为您整理了以下资料：

### 1. [Python 异步编程完整指南](https://example.com/async-guide)
这篇文章详细介绍了 Python 的 asyncio 库...

🔗 [点击阅读原文](https://example.com/async-guide)

### 2. [协程与并发编程](https://example.com/coroutines)
深入讲解了协程的工作原理...

🔗 [点击阅读原文](https://example.com/coroutines)

---

## 学习计划示例
### 第 1-7 天：基础阶段
- **学习目标**：掌握基本概念
- **每日任务**：
  1. 阅读教材第 1-3 章
  2. 完成课后习题
  3. 观看配套视频

### 第 8-14 天：进阶阶段
...

## 测验题目示例
### 题目 1：选择题
**问题**：以下哪个是...？

A. 选项 A
B. 选项 B
C. 选项 C
D. 选项 D

**答案**：C

**解析**：因为...

---"""

        # 插入工具列表
        full_prompt = f"{base_prompt}\n\n可用工具：\n{tools_desc}"

        return full_prompt

    def _detect_keyword_and_hint(self, goal: str) -> str:
        """检测用户输入的关键词并返回强制提示"""
        goal_lower = goal.lower()

        # 搜索关键词（优先级最高）
        if any(kw in goal_lower for kw in ["搜索", "查找", "找一下", "搜一下", "search"]):
            return "⚠️ 检测到搜索关键词！你必须立即调用 web_search 工具，不要调用其他工具！\n\n"

        # 学习资源类关键词（需要先搜索再生成计划）
        if any(kw in goal_lower for kw in ["教程", "资料", "学习资源", "推荐", "tutorial"]):
            return "⚠️ 检测到学习资源关键词！你必须先调用 web_search 搜索相关资源，然后再生成学习计划！\n\n"

        # 学习计划关键词（纯计划，不需要搜索）
        if any(kw in goal_lower for kw in ["学习计划", "学习路线", "怎么学", "如何学"]):
            # 如果同时包含"教程"等关键词，优先搜索
            if any(kw in goal_lower for kw in ["教程", "资料", "资源"]):
                return "⚠️ 检测到学习资源需求！你必须先调用 web_search 搜索相关资源，然后再生成学习计划！\n\n"
            return "⚠️ 检测到学习计划关键词！你必须立即调用 generate_study_plan 工具！\n\n"

        # 测验关键词
        if any(kw in goal_lower for kw in ["出题", "测验", "练习题", "题目", "quiz"]):
            return "⚠️ 检测到测验关键词！你必须立即调用 generate_quiz 工具！\n\n"

        # 知识图谱关键词
        if any(kw in goal_lower for kw in ["知识图谱", "知识结构", "思维导图", "知识地图"]):
            return "⚠️ 检测到知识图谱关键词！你必须立即调用 build_learning_map 工具！\n\n"

        # 知识点/概念关键词 → 先搜索本地知识库
        if any(kw in goal_lower for kw in ["知识点", "概念", "定义", "公式", "原理", "解题方法", "例题", "真题", "考点"]):
            return "⚠️ 检测到知识点查询关键词！你必须先调用 search_knowledge 工具搜索本地知识库，再结合结果作答！\n\n"

        return ""

    def _is_duplicate_response(self, response: str) -> bool:
        """检测响应是否重复"""
        # 标准化响应（去除空白字符）
        normalized = ' '.join(response.split())

        # 检查是否与历史响应相似
        for hist_response in self.response_history:
            # 计算相似度（简单的字符串匹配）
            if normalized == hist_response:
                logger.warning("检测到完全重复的响应")
                return True

            # 检查是否有 80% 以上的重叠
            if len(normalized) > 50 and len(hist_response) > 50:
                common_length = len(set(normalized.split()) & set(hist_response.split()))
                total_length = len(set(normalized.split()) | set(hist_response.split()))
                similarity = common_length / total_length if total_length > 0 else 0

                if similarity > 0.8:
                    logger.warning(f"检测到高度相似的响应（相似度: {similarity:.2f}）")
                    return True

        # 添加到历史记录
        self.response_history.append(normalized)

        # 保持历史记录大小
        if len(self.response_history) > self.max_history_size:
            self.response_history.pop(0)

        return False

    def _parse_react_response(self, response: str) -> Dict[str, Any]:
        """解析 ReAct 响应"""
        response = response.strip()

        # 检测 Final Answer（优先级最高）
        if "Final Answer:" in response:
            match = re.search(r"Final Answer:\s*(.+)", response, re.DOTALL)
            if match:
                return {
                    "type": "final_answer",
                    "content": match.group(1).strip()
                }

        # 检测 Action（优先级第二）
        if "Action:" in response and "Action Input:" in response:
            action_match = re.search(r"Action:\s*(\w+)", response)
            input_match = re.search(r"Action Input:\s*(\{.+?\})", response, re.DOTALL)

            if action_match and input_match:
                try:
                    tool_input = json.loads(input_match.group(1))
                    return {
                        "type": "action",
                        "tool_name": action_match.group(1),
                        "tool_input": tool_input
                    }
                except json.JSONDecodeError as e:
                    logger.error(f"解析 Action Input 失败: {str(e)}")
                    return {"type": "unknown", "content": response}

        # 检测 Thought（优先级第三）
        if "Thought:" in response:
            # 提取 Thought 内容（到下一个关键词之前）
            match = re.search(r"Thought:\s*(.+?)(?=\n(?:Action:|Final Answer:)|$)", response, re.DOTALL)
            if match:
                return {
                    "type": "thought",
                    "content": match.group(1).strip()
                }

        # 默认当作 Thought
        return {
            "type": "thought",
            "content": response
        }

    async def _execute_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """执行工具调用"""
        start_time = time.time()

        # 创建工具调用记录
        tool_call = AgentRepository.create_tool_call(
            self.db,
            session_id=self.session_id,
            tool_name=tool_name,
            input_params=tool_input
        )

        try:
            # 获取工具
            tool = self.tool_registry.get_tool(tool_name)
            if not tool:
                raise ValueError(f"工具不存在: {tool_name}")

            # 执行工具
            result = await tool.execute(self.db, self.user_id, **tool_input)

            # 计算执行时间
            execution_time = int((time.time() - start_time) * 1000)

            # 更新工具调用记录
            AgentRepository.update_tool_call(
                self.db,
                tool_call_id=tool_call.id,
                status="success",
                output_result=result,
                execution_time_ms=execution_time
            )

            logger.info(f"工具 {tool_name} 执行成功，耗时 {execution_time}ms")
            return result

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_msg = str(e)

            # 更新工具调用记录
            AgentRepository.update_tool_call(
                self.db,
                tool_call_id=tool_call.id,
                status="failed",
                error_message=error_msg,
                execution_time_ms=execution_time
            )

            logger.error(f"工具 {tool_name} 执行失败: {error_msg}")
            return {
                "success": False,
                "error": error_msg
            }

    async def execute_react_stream(self, goal: str) -> AsyncGenerator[Dict[str, Any], None]:
        """流式执行 ReAct 推理循环（生成器模式）"""
        try:
            logger.info(f"开始流式执行 ReAct 任务: {goal}")

            # 构建 ReAct Prompt
            system_prompt = self._build_react_prompt()

            # 记录初始步骤
            AgentRepository.add_step(
                self.db,
                session_id=self.session_id,
                step_number=0,
                step_type="goal",
                content=goal
            )

            # 推送目标事件
            yield {
                "type": "goal",
                "content": goal,
                "step_number": 0
            }
            await asyncio.sleep(0.3)  # 延迟 300ms，让流式效果更明显

            final_answer = None
            step_number = 1
            conversation_history = []

            # ReAct 循环
            while self.current_iteration < self.max_iterations:
                self.current_iteration += 1
                logger.info(f"ReAct 迭代 {self.current_iteration}/{self.max_iterations}")

                # 推送迭代开始事件
                yield {
                    "type": "iteration_start",
                    "iteration": self.current_iteration,
                    "max_iterations": self.max_iterations
                }

                # 调用 AI 生成下一步
                from utils.model_registry import registry

                messages = [{"role": "system", "content": system_prompt}]

                if self.current_iteration == 1:
                    messages.append({"role": "user", "content": f"任务目标: {goal}\n\n请开始思考并执行。"})
                else:
                    for msg in conversation_history:
                        messages.append(msg)

                response = registry.call_with_fallback(
                    messages=messages,
                    temperature=0.1,  # 降低到 0.1，提高稳定性和格式遵守度
                    max_tokens=2000
                )

                ai_response = response.get("text", "")
                logger.info(f"AI 响应: {ai_response[:200]}...")

                # 检测重复响应（流式模式）
                if self._is_duplicate_response(ai_response):
                    logger.warning("检测到重复响应，提示 AI 重新思考")
                    yield {
                        "type": "warning",
                        "message": "检测到重复响应，正在重新思考..."
                    }
                    conversation_history.append({"role": "assistant", "content": ai_response})
                    conversation_history.append({
                        "role": "user",
                        "content": "你刚才的回答与之前重复了，请重新思考并尝试不同的方法。"
                    })
                    continue

                # 解析响应
                parsed = self._parse_react_response(ai_response)

                if parsed["type"] == "final_answer":
                    # 找到最终答案
                    final_answer = parsed["content"]
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="final_answer",
                        content=final_answer
                    )

                    # 推送最终答案事件
                    yield {
                        "type": "final_answer",
                        "content": final_answer,
                        "step_number": step_number
                    }
                    await asyncio.sleep(0.3)  # 延迟 300ms
                    break

                elif parsed["type"] == "thought":
                    # 记录思考步骤
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="thought",
                        content=parsed["content"]
                    )

                    # 推送思考事件
                    yield {
                        "type": "thought",
                        "content": parsed["content"],
                        "step_number": step_number
                    }
                    await asyncio.sleep(0.5)  # 延迟 500ms

                    step_number += 1
                    conversation_history.append({"role": "assistant", "content": ai_response})

                elif parsed["type"] == "action":
                    # 记录行动步骤
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="action",
                        content=f"{parsed['tool_name']}: {json.dumps(parsed['tool_input'], ensure_ascii=False)}"
                    )

                    # 推送行动事件
                    yield {
                        "type": "action",
                        "tool_name": parsed["tool_name"],
                        "tool_input": parsed["tool_input"],
                        "step_number": step_number
                    }
                    await asyncio.sleep(0.3)  # 延迟 300ms

                    step_number += 1

                    # 执行工具调用
                    observation = await self._execute_tool(
                        parsed["tool_name"],
                        parsed["tool_input"]
                    )

                    # 记录观察结果
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="observation",
                        content=json.dumps(observation, ensure_ascii=False)
                    )

                    # 推送观察事件
                    yield {
                        "type": "observation",
                        "result": observation,
                        "step_number": step_number
                    }
                    await asyncio.sleep(0.5)  # 延迟 500ms

                    step_number += 1

                    # 将观察结果加入对话历史
                    observation_text = f"Observation: {json.dumps(observation, ensure_ascii=False)}"
                    conversation_history.append({"role": "assistant", "content": ai_response})
                    conversation_history.append({"role": "user", "content": observation_text})

                else:
                    # 无法解析
                    logger.warning(f"无法解析 AI 响应: {ai_response}")
                    conversation_history.append({"role": "assistant", "content": ai_response})
                    conversation_history.append({"role": "user", "content": "请按照 Thought/Action/Final Answer 格式继续"})

            # 更新会话状态
            if final_answer:
                AgentRepository.update_session_status(
                    self.db,
                    session_id=self.session_id,
                    status="completed"
                )
                yield {
                    "type": "completed",
                    "success": True,
                    "iterations": self.current_iteration
                }
            else:
                AgentRepository.update_session_status(
                    self.db,
                    session_id=self.session_id,
                    status="failed"
                )
                yield {
                    "type": "failed",
                    "success": False,
                    "error": "达到最大迭代次数，未找到最终答案",
                    "iterations": self.current_iteration
                }

        except Exception as e:
            logger.error(f"流式 ReAct 执行失败: {str(e)}")
            AgentRepository.update_session_status(
                self.db,
                session_id=self.session_id,
                status="failed"
            )
            yield {
                "type": "error",
                "success": False,
                "error": str(e)
            }

    async def execute_cot(self, goal: str) -> Dict[str, Any]:
        """执行 Chain of Thought 推理"""
        try:
            logger.info(f"开始执行 CoT 任务: {goal}")

            # 构建 CoT Prompt
            system_prompt = self._build_cot_prompt()

            # 记录初始步骤
            AgentRepository.add_step(
                self.db,
                session_id=self.session_id,
                step_number=0,
                step_type="goal",
                content=goal
            )

            # 调用 AI 进行 CoT 推理
            from utils.model_registry import registry

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"问题: {goal}\n\n请逐步思考并给出答案。"}
            ]

            response = registry.call_with_fallback(
                messages=messages,
                temperature=0.5,
                max_tokens=2000
            )

            ai_response = response.get("text", "")
            logger.info(f"CoT AI 响应: {ai_response[:200]}...")

            # 解析思考步骤
            steps = self._parse_cot_response(ai_response)

            # 记录每个思考步骤
            for i, step in enumerate(steps[:-1]):  # 最后一个是最终答案
                AgentRepository.add_step(
                    self.db,
                    session_id=self.session_id,
                    step_number=i + 1,
                    step_type="thought",
                    content=step
                )

            # 记录最终答案
            final_answer = steps[-1] if steps else ai_response
            AgentRepository.add_step(
                self.db,
                session_id=self.session_id,
                step_number=len(steps),
                step_type="final_answer",
                content=final_answer
            )

            # 更新会话状态
            AgentRepository.update_session_status(
                self.db,
                session_id=self.session_id,
                status="completed"
            )

            return {
                "success": True,
                "answer": final_answer,
                "steps": len(steps)
            }

        except Exception as e:
            logger.error(f"CoT 执行失败: {str(e)}")
            AgentRepository.update_session_status(
                self.db,
                session_id=self.session_id,
                status="failed"
            )
            return {
                "success": False,
                "error": str(e)
            }

    def _build_cot_prompt(self) -> str:
        """构建 CoT Prompt"""
        return """你是一个善于逐步思考的 AI 助手。

请使用以下格式回答问题：

步骤 1: [第一步思考]
步骤 2: [第二步思考]
步骤 3: [第三步思考]
...
最终答案: [综合所有步骤的最终答案]

重要规则：
1. 每个步骤都要清晰、具体，展示你的推理过程
2. 步骤之间要有逻辑关联
3. 最后必须给出"最终答案"
4. 不要使用工具，只进行纯推理"""

    def _parse_cot_response(self, response: str) -> List[str]:
        """解析 CoT 响应"""
        steps = []
        lines = response.strip().split('\n')

        current_step = ""
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 检测步骤标记
            if re.match(r'^步骤\s*\d+[:：]', line) or re.match(r'^第[一二三四五六七八九十]+步[:：]', line):
                if current_step:
                    steps.append(current_step)
                current_step = line
            elif line.startswith('最终答案') or line.startswith('Final Answer'):
                if current_step:
                    steps.append(current_step)
                # 提取最终答案
                final_answer = re.sub(r'^最终答案[:：]\s*', '', line)
                final_answer = re.sub(r'^Final Answer[:：]\s*', '', final_answer)
                steps.append(final_answer)
                break
            else:
                # 继续当前步骤
                if current_step:
                    current_step += " " + line
                else:
                    current_step = line

        # 如果没有找到最终答案，将最后一个步骤作为答案
        if current_step and not any('最终答案' in s or 'Final Answer' in s for s in steps):
            steps.append(current_step)

        return steps if steps else [response]

    async def execute_function_calling(self, goal: str) -> Dict[str, Any]:
        """执行 Function Calling 模式"""
        try:
            logger.info(f"开始执行 Function Calling 任务: {goal}")

            # 构建工具定义（OpenAI Function Calling 格式）
            tools = self._build_function_definitions()

            # 记录初始步骤
            AgentRepository.add_step(
                self.db,
                session_id=self.session_id,
                step_number=0,
                step_type="goal",
                content=goal
            )

            messages = [
                {"role": "system", "content": "你是一个智能学习助手，可以调用工具完成任务。"},
                {"role": "user", "content": goal}
            ]

            step_number = 1
            max_iterations = 10

            for iteration in range(max_iterations):
                self.current_iteration = iteration + 1
                logger.info(f"Function Calling 迭代 {self.current_iteration}/{max_iterations}")

                # 调用支持 Function Calling 的模型
                from utils.model_registry import registry

                try:
                    response = registry.call_with_function_calling(
                        messages=messages,
                        tools=tools,
                        temperature=0.3
                    )
                except Exception as e:
                    logger.warning(f"Function Calling 失败，降级到 ReAct: {e}")
                    # 降级到 ReAct 模式
                    return await self.execute_react(goal)

                # 检查是否有工具调用
                tool_calls = response.get("tool_calls")
                if tool_calls:
                    for tool_call in tool_calls:
                        tool_name = tool_call["function"]["name"]
                        tool_args = json.loads(tool_call["function"]["arguments"])

                        # 记录工具调用
                        AgentRepository.add_step(
                            self.db,
                            session_id=self.session_id,
                            step_number=step_number,
                            step_type="action",
                            content=f"{tool_name}: {json.dumps(tool_args, ensure_ascii=False)}"
                        )
                        step_number += 1

                        # 执行工具
                        result = await self._execute_tool(tool_name, tool_args)

                        # 记录观察结果
                        AgentRepository.add_step(
                            self.db,
                            session_id=self.session_id,
                            step_number=step_number,
                            step_type="observation",
                            content=json.dumps(result, ensure_ascii=False)
                        )
                        step_number += 1

                        # 将结果加入对话
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.get("id", ""),
                            "content": json.dumps(result, ensure_ascii=False)
                        })
                else:
                    # 没有工具调用，返回最终答案
                    final_answer = response.get("content", "")
                    AgentRepository.add_step(
                        self.db,
                        session_id=self.session_id,
                        step_number=step_number,
                        step_type="final_answer",
                        content=final_answer
                    )

                    # 更新会话状态
                    AgentRepository.update_session_status(
                        self.db,
                        session_id=self.session_id,
                        status="completed"
                    )

                    return {
                        "success": True,
                        "answer": final_answer,
                        "iterations": self.current_iteration
                    }

            # 达到最大迭代次数
            AgentRepository.update_session_status(
                self.db,
                session_id=self.session_id,
                status="failed"
            )
            return {
                "success": False,
                "error": "达到最大迭代次数，未找到最终答案",
                "iterations": self.current_iteration
            }

        except Exception as e:
            logger.error(f"Function Calling 执行失败: {str(e)}")
            AgentRepository.update_session_status(
                self.db,
                session_id=self.session_id,
                status="failed"
            )
            return {
                "success": False,
                "error": str(e)
            }

    def _build_function_definitions(self) -> List[Dict]:
        """构建 OpenAI Function Calling 格式的工具定义"""
        tools = []
        for tool in self.tool_registry._tools.values():
            tools.append({
                "type": "function",
                "function": {
                    "name": tool.definition.name,
                    "description": tool.definition.description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            p.name: {
                                "type": p.type,
                                "description": p.description
                            }
                            for p in tool.definition.parameters
                        },
                        "required": [p.name for p in tool.definition.parameters if p.required]
                    }
                }
            })
        return tools
