# Agent 系统改进说明

## 改进日期
2026-03-06

## 改进内容

### 1. Markdown 格式渲染支持 ✅

**前端改进**：
- 在 `AgentStepViewer.jsx` 中添加了 `react-markdown` 和 `remark-gfm` 支持
- Final Answer 现在使用 Markdown 渲染，支持：
  - 标题（# ## ###）
  - 列表（有序、无序）
  - 表格
  - 代码块
  - 粗体、斜体
  - 链接

**后端改进**：
- 更新了 Agent Prompt，要求 AI 输出详细的 Markdown 格式内容
- 提供了 Final Answer 格式示例，包括学习计划、测验题目等

### 2. 网络搜索工具 ✅

**新增工具**：`WebSearchTool`

**功能**：
- 使用 DuckDuckGo 搜索引擎（无需 API 密钥）
- 搜索互联网上的最新信息和资料
- 返回标题、摘要和来源链接

**使用示例**：
```json
{
  "query": "Python 最新特性",
  "max_results": 5
}
```

**返回格式**：
```
**1. Python 3.12 新特性**
Python 3.12 带来了更快的性能和新的语法特性...
来源: https://www.python.org/...

**2. Python 异步编程指南**
...
```

### 3. 本地知识库搜索工具 ✅

**新增工具**：`KnowledgeSearchTool`

**功能**：
- 搜索用户的历史学习记录
- 包括知识图谱、测验记录等
- 支持关键词模糊匹配

**使用示例**：
```json
{
  "query": "Python",
  "limit": 5
}
```

**返回格式**：
```
**1. [知识图谱] Python 基础**
包含 15 个知识点
创建时间: 2026-03-01

**2. [测验] Python 语法测试**
难度: medium, 题目数: 10
创建时间: 2026-03-02
```

## 安装依赖

### 后端依赖

```bash
cd backend
pip install duckduckgo-search
# 或者
pip install -r requirements.txt
```

### 前端依赖

前端已经安装了 `react-markdown` 和 `remark-gfm`，无需额外安装。

## 使用方法

### 1. 重启后端服务

```bash
cd backend
python main.py
```

### 2. 测试新功能

#### 测试网络搜索
```
用户输入：搜索 Python 最新特性
Agent 会自动调用 web_search 工具
```

#### 测试知识库搜索
```
用户输入：查找我之前学习的 Python 相关内容
Agent 会自动调用 search_knowledge 工具
```

#### 测试 Markdown 渲染
```
用户输入：生成一份 Python 学习计划
Agent 会返回格式化的 Markdown 内容，包括标题、列表等
```

## Agent Prompt 改进

### 新增规则
- 当用户需要最新信息或网络资料时，使用 `web_search` 工具
- 当用户询问历史学习记录时，使用 `search_knowledge` 工具

### Final Answer 格式要求
- 使用 Markdown 格式输出
- 包含标题、列表、表格等结构化元素
- 内容要详细、具体、有实际价值
- 提供示例格式模板

## 工具列表

现在 Agent 支持 6 个工具：

1. **parse_file** - 解析文档文件
2. **generate_quiz** - 生成测验题目
3. **build_learning_map** - 构建知识图谱
4. **generate_study_plan** - 生成学习计划
5. **web_search** - 网络搜索（新增）
6. **search_knowledge** - 知识库搜索（新增）

## 示例对话

### 示例 1：网络搜索 + 学习计划

**用户**：搜索 Python 异步编程的最新资料，并生成一份 7 天学习计划

**Agent 执行流程**：
1. Thought: 需要先搜索最新资料
2. Action: web_search
3. Observation: [搜索结果]
4. Thought: 基于搜索结果生成学习计划
5. Action: generate_study_plan
6. Observation: [学习计划]
7. Final Answer: [Markdown 格式的详细学习计划]

### 示例 2：知识库搜索 + 测验

**用户**：查找我之前学习的数据结构内容，并生成一份测验

**Agent 执行流程**：
1. Thought: 先搜索历史学习记录
2. Action: search_knowledge
3. Observation: [知识库搜索结果]
4. Thought: 基于历史内容生成测验
5. Action: generate_quiz
6. Observation: [测验题目]
7. Final Answer: [Markdown 格式的测验题目]

## 注意事项

### 网络搜索
- 使用 DuckDuckGo，无需 API 密钥
- 如果未安装 `duckduckgo-search`，会返回提示信息
- 搜索结果可能受网络环境影响

### 知识库搜索
- 只搜索当前用户的数据
- 支持模糊匹配
- 搜索范围：知识图谱、测验记录

### Markdown 渲染
- 支持 GitHub Flavored Markdown (GFM)
- 自动渲染表格、代码块等
- 使用 Tailwind CSS 的 `prose` 类进行样式美化

## 后续优化建议

### 短期（1-2 周）
1. 添加更多搜索源（Google Scholar、Wikipedia 等）
2. 优化搜索结果的相关性排序
3. 添加搜索结果缓存，避免重复搜索

### 中期（1-2 个月）
1. 实现向量搜索，提高知识库搜索准确度
2. 添加文档摘要功能
3. 支持多轮对话上下文

### 长期（3-6 个月）
1. 构建本地知识图谱索引
2. 实现智能推荐系统
3. 添加多模态搜索（图片、视频等）

## 问题排查

### 问题 1：网络搜索失败

**症状**：提示"网络搜索功能需要安装 duckduckgo-search 库"

**解决方案**：
```bash
pip install duckduckgo-search
```

### 问题 2：Markdown 渲染不正常

**症状**：Markdown 内容显示为纯文本

**解决方案**：
1. 检查前端是否安装了 `react-markdown` 和 `remark-gfm`
2. 清除浏览器缓存并刷新页面

### 问题 3：知识库搜索无结果

**症状**：提示"在知识库中未"

**原因**：
- 用户还没有创建相关的学习记录
- 搜索关键词不匹配

**解决方案**：
- 先创建一些学习记录（知识图谱、测验等）
- 使用更通用的关键词

## 技术栈

### 后端
- FastAPI
- SQLAlchemy
- DuckDuckGo Search API
- Pydantic

### 前端
- React
- react-markdown
- remark-gfm
- Tailwind CSS

## 贡献者
- 开发团队
- 智学伴 AI 个性化学习平台

## 更新日志

### v4.1.0 (2026-03-06)
- ✅ 添加 Markdown 格式渲染支持
- ✅ 添加网络搜索工具（WebSearchTool）
- ✅ 添加本地知识库搜索工具（KnowledgeSearchTool）
- ✅ 优化 Agent Prompt，要求输出详细的 Markdown 内容
- ✅ 更新工具注册表，支持 6 个工具

### v4.0.0 (2026-03-05)
- ✅ 实现 ReAct 推理循环
- ✅ 添加 4 个基础工具
- ✅ 实现会话管理和步骤追踪
- ✅ 优化错误处理
- ✅ 添加时间线视图
