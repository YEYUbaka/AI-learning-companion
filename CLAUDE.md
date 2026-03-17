# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 交互规范

**语言要求**: 非必要情况下，所有回复必须使用中文。仅在以下情况使用英文：
- 代码注释、变量名、函数名
- 技术术语无合适中文翻译时
- 用户明确要求使用英文

## 项目概述

智学伴 AI 个性化学习平台 - 基于 FastAPI + React 的前后端分离架构，支持多 AI 模型的智能学习系统。

## 常用命令

### 后端开发
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pytest  # 运行测试
```

### 前端开发
```bash
cd frontend
npm install
npm run dev  # 启动开发服务器 (http://localhost:5173)
npm run build  # 生产构建
```

### 一键启动
```bash
# 项目根目录提供了批处理文件
5-一键启动前后端.bat  # Windows 快速启动
```

## 架构规范

### 分层架构（强制）
严格遵循：`router → service → repository → models → utils`

- **routers/**: 仅处理请求校验、权限验证、request→service 调用，禁止写业务逻辑
- **services/**: 所有业务逻辑层，包括 AI 调用、数据处理
- **repositories/**: 数据访问层（如果存在）
- **models/**: SQLAlchemy ORM 模型
- **schemas/**: Pydantic 请求/响应模型
- **utils/**: 工具函数（文件解析、PDF 生成等）

### AI 调用规范
1. **统一入口**: 所有 AI 模型调用必须通过 `backend/services/ai_service.py`
2. **模型注册**: 使用 `backend/utils/model_registry.py` 提供 provider 实例
3. **Prompt 管理**: 所有 prompts 存储在数据库 `prompts` 表中，通过管理后台 CRUD
4. **模型配置**: 存储在 `model_config` 表（provider, base_url, encrypted_api_key, priority）
5. **System Prompt 注入**: 每次调用必须从 `prompt_service.get_system_prompt()` 获取并插入 messages 首位
6. **JSON 输出**: AI 返回必须用 ```json\n{...}\n``` 包裹，AIService 需解析并校验
7. **品牌替换**: AI 返回含模型签名时，替换为："我是智学伴，一个由全国大学生计算机设计大赛参赛团队开发的 AI 学习助手，不属于任何商业AI公司。"

### 数据库规范
- **唯一支持：MySQL**（不再支持 SQLite，仅测试环境使用内存 SQLite）
- 连接字符串格式：`mysql+pymysql://root:password@localhost:3306/zhixueban?charset=utf8mb4`
- 结构化字段使用 `Column(JSON)` 而非字符串
- 密钥存储前调用 `core/security.encrypt_secret()`，读取时 `decrypt_secret()`
- 开发模式使用 `Base.metadata.create_all(bind=engine)` 自动建表
- DateTime 字段不带 timezone 参数（MySQL 兼容性）

### 文件解析
统一在 `backend/utils/file_parser.py` 处理：
- `.pdf`: PyMuPDF
- `.docx`: python-docx
- `.pptx`: python-pptx
- `.txt/.md`: 直接读取
- 大文件截断：超过 12000 字符截取前 8000 字

### 前端规范
- **状态管理**: 使用 Zustand（`src/store/`）
- **API 调用**: 统一通过 `src/api/apiClient.js`，自动注入 JWT header
- **Token 存储**: 严格使用 sessionStorage，禁止 localStorage 存储 token/userInfo
- **Admin 判断**: 仅通过 `userInfo.role === 'admin'` 判断，禁止 email 前缀检查
- **Markdown 渲染**: 使用 `react-markdown` + `remark-gfm`
- **图表**: 统一使用 Recharts
- **知识图谱**: 使用 `react-force-graph-2d`
- **组件拆分**: 避免 300+ 行巨型页面，拆分为小组件

### RAG 知识库（可选功能）
- 核心依赖在 `requirements-rag.txt`，与主项目分离
- 安装：`pip install -r requirements-rag.txt`
- 不安装时后端仍可正常启动，RAG 功能自动禁用
- Torch CPU 版：`pip install torch --index-url https://download.pytorch.org/whl/cpu`

### 技术栈变更规范（强制）

每次引入新技术、框架或依赖时，必须同步更新：
1. `CLAUDE.md` 的"架构规范"章节
2. `README.md` 的技术栈描述
3. `requirements.txt` 或 `package.json`
4. `.env.example`（如有新环境变量）

未同步文档的技术变更视为不完整，需在下次提交时补全。

## 关键模块

### 核心服务
- `ai_service.py`: AI 模型调用统一接口
- `prompt_service.py`: Prompt 模板管理
- `quiz_service.py`: 智能组卷
- `learning_map_service.py`: 知识图谱生成
- `bootstrap_service.py`: 启动时自动同步种子数据

### 安全模块
- `core/security.py`: JWT 认证、密钥加密/解密
- `core/config.py`: 环境变量配置管理
- `core/logger.py`: 统一日志管理（禁止使用 print/console.log）

### 工具模块
- `utils/file_parser.py`: 文档解析
- `utils/model_registry.py`: AI 模型注册与选择

## 环境配置

关键环境变量（`.env`，参考 `.env.example`）：
- `DATABASE_URL`: MySQL 连接字符串
- `SECRET_KEY`: JWT 密钥（生产必改）
- `ENCRYPTION_KEY`: API 密钥加密密钥
- `DEFAULT_AI_PROVIDER`: 默认 AI 提供商
- `AUTO_SYNC_SEED_DATA`: 是否自动同步种子数据（true/false）
- `PROMPT_SEED_PATH`: Prompt 种子数据路径（相对于 backend/ 目录）
- `MODEL_CONFIG_SEED_PATH`: 模型配置种子数据路径
- `VITE_ALLOWED_HOSTS`: Vite 开发服务器允许的域名（逗号分隔）

## 测试规范

- 测试文件位置：`backend/tests/`
- 每个 service 至少 3 个单测（happy path、错误输入、fallback）
- AIService 测试使用 mock provider
- 测试使用内存 SQLite：`sqlite:///:memory:`

## 安全约束

1. 所有敏感接口必须使用 JWT 认证
2. Admin API 必须 `Depends(get_current_admin)`
3. API keys 不写入代码，存入数据库（加密）或 `.env`
4. **禁止前端保存密码或 Token 到 localStorage（仅 sessionStorage）**
5. Admin 权限判断仅通过 `role === 'admin'`，禁止 email 前缀检查

## 代码风格

- **Python**: 使用 type hints，遵循 Black 风格
- **前端**: ESLint + Prettier
- **日志**: 后端使用 `core/logger.py`，前端使用 logger wrapper
- **类型**: 所有接口使用 Pydantic 请求/响应模型并加类型注解

## UI/UX 设计规范

### 禁止使用的元素

1. **Emoji 表情符号**
   - [禁止] 代码中禁止使用任何 emoji（✅ ❌ 🚀 📝 等）(如有必要可以阿里巴巴的矢量图标库https://www.iconfont.cn/使用svg图标)
   - [禁止] 日志输出禁止使用 emoji
   - [禁止] 文档中避免使用 emoji（README 除外）
   - [允许] 使用文字标记：[OK]、[FAIL]、[INFO]、[WARNING]
2. **AI 风格配色**
   - [禁止] 禁止使用渐变蓝紫色（blue-purple gradient）
   - [禁止] 禁止使用磨砂效果（backdrop-blur、glassmorphism）
   - [禁止] 禁止使用霓虹发光效果（neon glow）
   - [允许] 使用商业级配色方案（参考成熟产品）

### 推荐的设计风格

**配色方案**：

- 网站应该采用一种统一的配色方案，最多不超过四种颜色。使用过多的颜色会使网站显得杂乱无章。建议遵循 60-30-10 设计规则：使用 60% 的主色、30% 的辅助色和 10% 的强调色

- 主色调：专业蓝（#2563eb）、深灰（#1e293b）
- 辅助色：绿色（成功）、红色（错误）、橙色（警告）
- 背景：纯白/浅灰（亮色模式）、深灰/黑色（暗色模式）
- 避免：渐变背景、过度阴影、透明模糊

**参考项目**：

- GitHub、GitLab（代码托管平台）
- Notion、Linear（生产力工具）
- Stripe、Vercel（开发者平台）

**设计原则**：
- 简洁、专业、高效
- 注重可读性和可访问性
- 遵循 Material Design 或 Apple HIG 规范

## 禁止事项

1. [禁止] 在 router 中写业务逻辑
2. [禁止] 直接在路由中调用 AI
3. [禁止] 使用字符串保存 JSON（必须用 Column(JSON)）
4. [禁止] 硬编码敏感信息
5. [禁止] 使用 console.log/print 调试（必须删除）
6. [禁止] 随意创建文件，不遵守目录结构
7. [禁止] 覆盖文件前不询问或不生成备份

## 管理后台

- 路径：`/admin`
- Prompt/Model 修改即时生效（in-memory cache + invalidation）
- 首次运行无 admin 账户时生成临时 token（查看启动日志）
- 可上传/更新 provider API key（自动加密存储）

## API 文档

启动后端后访问：
- Swagger UI: http://127.0.0.1:8000/docs
- 健康检查: http://127.0.0.1:8000/health

## 特殊注意

1. **Windows 路径**: 使用完整绝对路径（带盘符和反斜杠）
2. **中文支持**: 所有文件使用 UTF-8 编码
3. **数据库**: 必须使用 MySQL，确保服务已启动
4. **种子数据**: 修改 `.env` 或 JSON 后重启后端自动同步

## 修改记录

### 2026-03-04
- 初始化 Git 仓库并推送到 GitHub
- 添加 UI/UX 设计规范，禁止使用 emoji 和 AI 风格配色
- 完成商业级 UI 重构：
  - 移除所有页面的渐变背景和磨砂效果
  - 统一使用纯色设计（暗色：slate-900/800，亮色：gray-50/white）
  - 重构 Login、Register、Dashboard、AIChat、StudyPlan、LearningMap、Quiz 等主要页面
  - 批量处理管理后台页面

### 2026-03-06
- 修复 Agent 系统核心问题：
  - 实现响应去重机制（80% 相似度检测）
  - 解决"只说不做"问题（降低 Temperature 至 0.1，添加关键词触发规则）
  - 修复搜索功能（升级 duckduckgo-search → ddgs 9.8.0）
  - 确保搜索结果返回可点击的 Markdown 链接
  - 添加关键词强制检测机制 `_detect_keyword_and_hint()`，解决 AI 调用错误工具的问题
  - 修复 `build_learning_map` 工具：修正静态类调用方式、参数映射（`content`→`course_topic`）、返回值处理
  - 修复前端 `execution_time_ms` 空值显示问题
- 关键文件：
  - `backend/services/agent_executor.py`：核心执行引擎，含去重机制和关键词检测
  - `backend/utils/agent_tools.py`：工具定义和实现
  - `frontend/src/components/AgentStepViewer.jsx`：步骤展示组件，支持 Markdown 渲染
- 测试结果：搜索、学习计划、知识图谱功能均正常

### 2026-03-07（企业级审查整改）
- 数据库切换为 MySQL（唯一支持）：
  - 添加 `pymysql>=1.1.0`，移除 `pyodbc==5.1.0`
  - 更新 `.env` 启用 MySQL 连接字符串
  - `config.py` 默认值改为 MySQL
  - `api_call_log.py` DateTime 去掉 timezone 参数
- RAG 依赖分离到 `requirements-rag.txt`（可选功能）
- 后端代码规范：
  - `main.py` 删除所有 print/sys.stdout.write，统一使用 logger
  - `main.py` 修复重复导入，日志输出改为 [OK]/[FAIL]/[WARN] 标记
  - `models/__init__.py` 补充 knowledge 模型导出
  - 删除意外文件 `backend/=6.0.0`
- 前端代码规范：
  - 删除废弃文件 `AIChat.jsx`（59KB）
  - 移除所有 localStorage token/userInfo 存储，严格使用 sessionStorage
  - `AdminProtectedRoute.jsx` 移除 email 前缀检查，仅保留 role 判断
  - `Navbar.jsx` 同步修复
  - `AdminLayout.jsx` emoji 图标全部替换为 SVG
  - `agentApi.js` 移除硬编码 URL，复用 apiClient 逻辑
  - `themeStore.js` 修正 toggleTheme 变量命名（newTheme → newMode/newTheme）
  - `vite.config.js` allowedHosts 改为读取环境变量 VITE_ALLOWED_HOSTS
- 文档同步更新（CLAUDE.md、README.md）
- 新建 `backend/.env.example`
- 新增"技术栈变更规范"章节（强制同步文档）
