# frontend/CLAUDE.md

> 本文件是根目录 `CLAUDE.md` 的前端专项补充，聚焦于 `frontend/` 目录内部结构。
> 根目录 `CLAUDE.md` 中的前端规范、安全约束、UI/UX 设计规范等全局规则仍然有效。

## 目录结构速查

```
frontend/
├── index.html
├── package.json
├── vite.config.js                   # Vite 配置（allowedHosts 读取环境变量）
├── tailwind.config.js
├── postcss.config.js
├── nginx.conf                       # 生产环境 Nginx 配置（含 SSE 特殊处理）
└── src/
    ├── main.jsx                     # 应用入口，挂载 React + Router
    ├── App.jsx                      # 路由表定义
    ├── api/
    │   ├── apiClient.js             # 统一 axios 实例（自动注入 JWT）
    │   ├── agentApi.js              # Agent SSE 流式接口（hostname 判断）
    │   └── knowledgeApi.js          # 知识库 API 封装
    ├── components/
    │   ├── Navbar.jsx               # 顶部导航栏
    │   ├── AdminLayout.jsx          # 管理后台布局（侧边栏）
    │   ├── AdminProtectedRoute.jsx  # 管理后台路由守卫（role=admin）
    │   ├── ProtectedRoute.jsx       # 登录路由守卫
    │   ├── AgentStepViewer.jsx      # Agent 步骤展示（支持 Markdown 渲染）
    │   ├── PaperGenerator.jsx       # 试卷生成组件
    │   ├── MindMapNode.jsx          # 知识图谱节点组件
    │   ├── PageDecorations.jsx      # 页面装饰组件
    │   ├── icons/
    │   │   └── index.jsx            # 统一 SVG 图标导出
    │   └── ui/
    │       ├── Button.jsx           # 通用按钮组件
    │       ├── Card.jsx             # 通用卡片组件
    │       ├── Motion.jsx           # 动画封装组件
    │       ├── Skeleton.jsx         # 骨架屏组件
    │       └── AppBadge.jsx         # 徽章组件
    ├── pages/
    │   ├── Login.jsx                # 登录页 (/login)
    │   ├── Register.jsx             # 注册页 (/register)
    │   ├── Dashboard.jsx            # 首页 (/)
    │   ├── AgentChat.jsx            # AI Agent 对话页 (/agent) [主要 AI 入口]
    │   ├── AIChat.jsx               # [废弃遗留文件，路由不指向此文件]
    │   ├── StudyPlan.jsx            # 学习计划页 (/study-plan)
    │   ├── Quiz.jsx                 # 测验页 (/quiz)
    │   ├── QuizResult.jsx           # 测验结果页 (/quiz/result)
    │   ├── LearningMap.jsx          # 知识图谱页 (/learning-map)
    │   ├── UploadFile.jsx           # 文件上传页 (/upload)
    │   └── Admin/
    │       ├── Dashboard.jsx        # 管理后台首页 (/admin)
    │       ├── ModelManagement.jsx  # AI 模型管理 (/admin/models)
    │       ├── PromptEditor.jsx     # Prompt 编辑器 (/admin/prompts)
    │       ├── UserManagement.jsx   # 用户管理 (/admin/users)
    │       ├── KnowledgeAdmin.jsx   # 知识库管理 (/admin/knowledge)
    │       ├── APICallLogs.jsx      # API 调用日志 (/admin/logs)
    │       └── SystemConfig.jsx     # 系统配置 (/admin/config)
    └── store/
        ├── themeStore.js            # 主题状态（亮色/暗色模式）
        └── learningMapStore.js      # 知识图谱状态
```

## 路由表（准确版）

| 路由 | 组件文件 | 说明 | 需要登录 |
|------|---------|------|---------|
| `/` | `Dashboard.jsx` | 首页 / 功能导航 | 是 |
| `/login` | `Login.jsx` | 登录页 | 否 |
| `/register` | `Register.jsx` | 注册页 | 否 |
| `/agent` | `AgentChat.jsx` | AI Agent 对话（**主要 AI 入口**） | 是 |
| `/study-plan` | `StudyPlan.jsx` | 学习计划生成 | 是 |
| `/quiz` | `Quiz.jsx` | 智能测验 | 是 |
| `/quiz/result` | `QuizResult.jsx` | 测验结果详情 | 是 |
| `/learning-map` | `LearningMap.jsx` | 知识图谱可视化 | 是 |
| `/upload` | `UploadFile.jsx` | 文件上传 | 是 |
| `/admin` | `Admin/Dashboard.jsx` | 管理后台首页 | 是（role=admin） |
| `/admin/models` | `Admin/ModelManagement.jsx` | AI Provider 管理 | 是（role=admin） |
| `/admin/prompts` | `Admin/PromptEditor.jsx` | Prompt 模板管理 | 是（role=admin） |
| `/admin/users` | `Admin/UserManagement.jsx` | 用户管理 | 是（role=admin） |
| `/admin/knowledge` | `Admin/KnowledgeAdmin.jsx` | 知识库管理 | 是（role=admin） |
| `/admin/logs` | `Admin/APICallLogs.jsx` | API 调用日志 | 是（role=admin） |
| `/admin/config` | `Admin/SystemConfig.jsx` | 系统配置 | 是（role=admin） |

**重要提醒**：
- `/ai` 路由已不再使用（旧路由），导航中"AI助手"指向 `/agent`
- `AIChat.jsx` 文件存在但为废弃遗留，新功能请编辑 `AgentChat.jsx`
- Admin 路由守卫通过 `AdminProtectedRoute.jsx` 实现，仅校验 `userInfo.role === 'admin'`

## API 层约定

### `src/api/apiClient.js` — 统一请求客户端
- axios 实例，`baseURL` 指向后端
- 请求拦截器：自动从 `sessionStorage` 读取 JWT token，注入 `Authorization: Bearer ...` header
- 响应拦截器：统一处理 401（跳转登录）、网络错误等
- **Token 存储规则**：严格使用 `sessionStorage`，禁止 `localStorage`

### `src/api/agentApi.js` — Agent SSE 流式接口
- 使用 `EventSource` / 原生 fetch 实现 SSE（Server-Sent Events）流式接收
- **URL 选择逻辑**（hostname 判断）：
  - `localhost` 或 `127.0.0.1` → 直连后端 `http://localhost:8000/api/agent/task/stream`
  - 其他域名（生产/外网）→ 使用相对路径 `/api/agent/task/stream`（经 Nginx 转发）
- 已移除硬编码 URL，改为动态检测

### `src/api/knowledgeApi.js` — 知识库接口
- 封装 `/api/v1/knowledge/` 相关接口
- 包含文档上传、列表查询、删除等操作

## Zustand Store 结构

### `themeStore.js`
```js
state: {
  theme: 'light' | 'dark',  // 当前主题模式
}
actions: {
  toggleTheme(),             // 切换主题（注意：变量命名为 newMode/newTheme，非 newTheme 单一变量）
  setTheme(mode),            // 直接设置主题
}
```

### `learningMapStore.js`
```js
state: {
  graphData: { nodes, links },  // 知识图谱数据
  loading: boolean,
  error: string | null,
}
actions: {
  fetchGraph(topic, fileId),    // 获取知识图谱
  clearGraph(),                 // 清空图谱数据
}
```

## 关键组件说明

### `AgentStepViewer.jsx`
- 展示 Agent 执行步骤列表（思考 → 工具调用 → 结果）
- 支持 Markdown 渲染（使用 `react-markdown` + `remark-gfm`）
- 实时接收 SSE 推送的步骤事件并更新 UI

### `AdminLayout.jsx`
- 管理后台侧边栏布局
- 图标全部使用 SVG（已移除 emoji，位于 `components/icons/index.jsx`）
- 含 admin 权限校验

## 技术栈速查

| 类别 | 技术/库 | 用途 |
|------|---------|------|
| UI 框架 | React 18 | 核心框架 |
| 构建工具 | Vite | 开发服务器 + 生产构建 |
| 路由 | React Router DOM v6 | 页面路由管理 |
| HTTP | Axios | API 请求（apiClient.js 封装） |
| 状态管理 | Zustand | 全局状态（主题、图谱数据） |
| 样式 | TailwindCSS | 原子化样式 |
| Markdown | react-markdown + remark-gfm | AI 回复内容渲染 |
| 图表 | Recharts | 数据可视化图表 |
| 知识图谱 | react-force-graph-2d | 知识图谱力导向图可视化 |
| 流式通信 | SSE（EventSource/fetch） | Agent 实时步骤推送 |

## 构建说明

```bash
# 开发模式（热更新）
cd E:\AI_projects\Web\frontend
npm run dev
# 访问：http://localhost:5173（端口被占用时自动切换到 5174）

# 生产构建
npm run build
# 输出到 dist/ 目录

# 生产环境 Nginx 配置
# frontend/nginx.conf — 注意 SSE 特殊处理块：
# location = /api/agent/task/stream { proxy_buffering off; gzip off; ... }
```

## 注意事项

1. **Admin 权限判断**：仅通过 `userInfo.role === 'admin'`，禁止使用 email 前缀或其他方式
2. **Token 存储**：`sessionStorage` only，用户刷新页面/关闭标签页会清除登录状态（符合安全规范）
3. **SSE 调试**：本地开发时 agentApi.js 直连 8000 端口，生产环境通过 Nginx 反代，两套配置自动切换
4. **组件拆分原则**：单文件超过 300 行必须拆分为子组件，避免巨型页面
5. **禁止使用 emoji**：UI 图标统一使用 SVG（`components/icons/index.jsx`）
