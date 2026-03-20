# 可点击链接功能测试指南

## 更新日期
2026-03-06

## 改进内容

### 1. 后端改进 ✅

**WebSearchTool 输出格式**：
```markdown
**1. [标题](URL)**

摘要内容...

🔗 [点击访问原文](URL)
```

**改进前**：
```
**1. 标题**
摘要内容...
来源: https://example.com
```

**改进后**：
```markdown
**1. [Python 异步编程指南](https://example.com)**

详细介绍了 asyncio 库的使用方法...

🔗 [点击访问原文](https://example.com)
```

### 2. 前端改进 ✅

**ReactMarkdown 配置**：
- 添加了自定义 `<a>` 标签组件
- 设置 `target="_blank"` - 在新标签页打开
- 设置 `rel="noopener noreferrer"` - 安全性
- 添加蓝色链接样式和下划线

### 3. Agent Prompt 改进 ✅

**新增要求**：
- 所有 URL 必须转换为 Markdown 链接格式
- 提供了搜索结果的示例格式
- 强调链接必须可点击

## 测试步骤

### 步骤 1：重启后端服务

```bash
cd backend
# 停止当前服务（Ctrl+C）
python main.py
```

### 步骤 2：刷新前端页面

```bash
# 在浏览器中刷新页面（Ctrl+F5 强制刷新）
http://localhost:5173/agent
```

### 步骤 3：测试网络搜索

**测试用例 1：简单搜索**
```
输入：搜索 Python 异步编程
```

**预期结果**：
- 显示 5 条搜索结果
- 每条结果的标题是蓝色可点击链接
- 底部有 "🔗 点击访问原文" 链接
- 点击链接在新标签页打开

**测试用例 2：搜索 + 总结**
```
输入：搜索 React Hooks 的最新用法，并总结要点
```

**预期结果**：
- Agent 先调用 web_search 工具
- 在 Final Answer 中整理搜索结果
- 所有 URL 都转换为可点击的 Markdown 链接

**测试用例 3：搜索 + 学习计划**
```
输入：搜索机器学习入门资料，并生成 7 天学习计划
```

**预期结果**：
- Agent 先搜索资料
- 然后生成学习计划
- 学习计划中引用搜索结果的链接
- 所有链接可点击

### 步骤 4：验证链接功能

**检查项**：
1. ✅ 链接显示为蓝色
2. ✅ 链接有下划线
3. ✅ 鼠标悬停时变为深蓝色
4. ✅ 点击链接在新标签页打开
5. ✅ 链接地址正确

## 链接格式对比

### Markdown 源码
```markdown
**1. [Python 官方文档](https://docs.python.org)**

这是 Python 的官方文档...

🔗 [点击访问原文](https://docs.python.org)
```

### 渲染效果
**1. [Python 官方文档](https://docs.python.org)**

这是 Python 的官方文档...

🔗 [点击访问原文](https://docs.python.org)

## 技术实现

### 后端（agent_tools.py）
```python
formatted_results = "\n\n".join([
    f"**{i+1}. [{r['title']}]({r['url']})**\n\n{r['snippet']}\n\n🔗 [点击访问原文]({r['url']})"
    for i, r in enumerate(results)
])
```

### 前端（AgentStepViewer.jsx）
```jsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    a: ({node, ...props}) => (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      />
    )
  }}
>
  {step.content}
</ReactMarkdown>
```

### Agent Prompt
```
**如果包含网络搜索结果，必须使用 Markdown 链接格式 [链接文本](URL)，让用户可以直接点击访问**
**所有 URL 都必须转换为可点击的链接，格式：[点击访问](URL)**
```

## 常见问题

### 问题 1：链接不可点击

**症状**：链接显示为纯文本，无法点击

**原因**：
- Markdown 格式不正确
- ReactMarkdown 配置问题

**解决方案**：
1. 检查后端返回的格式是否为 `[文本](URL)`
2. 检查是否正确配置了 `components.a`
3. 清除浏览器缓存并刷新

### 问题 2：链接在当前页面打开

**症状**：点击链接后，当前页面跳转

**原因**：缺少 `target="_blank"` 属性

**解决方案**：
- 已在 `AgentStepViewer.jsx` 中配置
- 确保使用最新代码

### 问题 3：链接样式不正确

**症状**：链接没有蓝色或下划线

**原因**：CSS 类未生效

**解决方案**：
- 检查 `className="text-blue-600 hover:text-blue-800 underline"`
- 确保 Tailwind CSS 正常工作

### 问题 4：Agent 不返回链接格式

**症状**：Agent 返回的是 `来源: URL` 而不是 `[文本](URL)`

**原因**：
- 后端代码未更新
- Agent 没有遵循 Prompt 要求

**解决方案**：
1. 确认后端代码已更新
2. 重启后端服务
3. 如果 Agent 仍不遵循，可能需要调整 Prompt 或使用更强的模型

## 示例对话

### 示例 1：网络搜索

**用户输入**：
```
搜索 FastAPI 最佳实践
```

**Agent 输出**：
```markdown
## FastAPI 最佳实践搜索结果

根据搜索结果，我为您整理了以下资料：

### 1. [FastAPI 官方文档 - 最佳实践](https://fastapi.tiangolo.com/best-practices/)

FastAPI 官方推荐的最佳实践，包括项目结构、依赖注入、错误处理等...

🔗 [点击阅读原文](https://fastapi.tiangolo.com/best-practices/)

### 2. [FastAPI 生产环境部署指南](https://example.com/fastapi-production)

详细介绍了如何将 FastAPI 应用部署到生产环境...

🔗 [点击阅读原文](https://example.com/fastapi-production)

### 3. [FastAPI 性能优化技巧](https://example.com/fastapi-performance)

分享了多个提升 FastAPI 性能的实用技巧...

🔗 [点击阅读原文](https://example.com/fastapi-performance)

---

**总结要点**：
1. 使用依赖注入管理
2. 合理使用异步函数提升性能
3. 添加适当的错误处理和日志
4. 使用 Pydantic 进行数据验证
5. 部署时使用 Gunicorn + Uvicorn Workers
```

### 示例 2：搜索 + 学习计划

**用户输入**：
```
搜索 React Hooks 教程，并生成 5 天学习计划
```

**Agent 输出**：
```markdown
## React Hooks 5 天学习计划

基于搜索到的优质资料，我为您制定了以下学习计划：

### 第 1 天：Hooks 基础
**学习目标**：理解 Hooks 的基本概念

**推荐资料**：
- [React 官方文档 - Hooks 简介](https://react.dev/reference/react)
- [useState 和 useEffect 详解](https://example.com/hooks-basics)

**每日任务**：
1. 阅读官方文档的 Hooks 章节
2. 练习 useState 的基本用法
3. 完成 3 个小练习

### 第 2 天：useEffect 深入
**学习目标**：掌握副作用处理

**推荐资料**：
- [useEffect 完整指南](https://example.com/useeffect-guide)

**每日任务**：
1. 学习 useEffect 的依赖数组
2. 理解清理函数的作用
3. 实现一个数据获取的例子

### 第 3-5 天：...
```

## 验收标准

### 功能验收
- ✅ 搜索结果中的标题是可点击链接
- ✅ 每条结果底部有 "点击访问原文" 链接
- ✅ 点击链接在新标签页打开
- ✅ 链接地址正确无误
- ✅ Agent 能正确使用 Markdown 链接格式

### 样式验收
- ✅ 链接显示为蓝色（#2563eb）
- ✅ 链接有下划线
- ✅ 鼠标悬停时变为深蓝色（#1e40af）
- ✅ 链接与周围文本有明显区分

### 用户体验验收
- ✅ 链接易于识别
- ✅ 点击反馈明显
- ✅ 新标签页打开不影响当前页面
- ✅ 链接文本描述清晰

## 后续优化建议

### 短期
1. 添加链接预览功能（鼠标悬停显示网站信息）
2. 添加链接图标（🔗 或外部链接图标）
3. 支持链接收藏功能

### 中期
1. 添加链接有效性检查
2. 缓存搜索结果，避免重复搜索
3. 支持更多搜索引擎

### 长期
1. 实现智能链接推荐
2. 构建个人知识库链接索引
3. 支持链接标注和笔记

## 更新日志

### v4.1.1 (2026-03-06)
- ✅ 修复链接不可点击的问题
- ✅ 将搜索结果格式改为 Markdown 链接
- ✅ 配置 ReactMarkdown 在新标签页打开链接
- ✅ 更新 Agent Prompt，强调使用链接格式
- ✅ 添加链接样式（蓝色、下划线、悬停效果）
