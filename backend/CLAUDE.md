# backend/CLAUDE.md

> 本文件是根目录 `CLAUDE.md` 的后端专项补充，聚焦于 `backend/` 目录内部结构。
> 根目录 `CLAUDE.md` 中的架构规范、安全约束、代码风格等全局规则仍然有效。

## 目录结构速查

```
backend/
├── main.py                          # FastAPI 应用入口，注册所有路由
├── database.py                      # SQLAlchemy 引擎 + Session 工厂
├── core/
│   ├── config.py                    # Settings（Pydantic BaseSettings），所有环境变量定义
│   ├── security.py                  # JWT 签发/校验、encrypt_secret/decrypt_secret
│   └── logger.py                    # 统一日志（禁止使用 print，必须用此模块）
├── models/                          # SQLAlchemy ORM 模型（仅定义表结构）
│   ├── __init__.py                  # 统一导出所有模型（新增模型必须在此注册）
│   ├── users.py                     # User 表
│   ├── prompts.py                   # Prompt 模板表
│   ├── model_config.py              # ModelConfig 表（provider 配置）
│   ├── api_call_log.py              # AI 调用日志表
│   ├── knowledge.py                 # KnowledgeDocument、KnowledgeChunk 表
│   └── agent_task.py                # Agent 任务表
├── schemas/                         # Pydantic 请求/响应模型（接口契约）
├── routers/                         # 路由层（仅处理请求校验和权限，禁止写业务逻辑）
│   ├── auth.py                      # /api/v1/auth/
│   ├── ai.py                        # /api/v1/ai/
│   ├── agent.py                     # /api/v1/agent/（SSE 流式）
│   ├── quiz.py                      # /api/v1/quiz/
│   ├── study_plan.py                # /api/v1/study-plan/
│   ├── learning_map.py              # /api/v1/learning-map/
│   ├── knowledge.py                 # /api/v1/knowledge/
│   ├── upload.py                    # /api/v1/upload/
│   └── admin/                       # /api/v1/admin/（需 role=admin）
│       ├── prompts.py
│       ├── models.py
│       ├── users.py
│       └── logs.py
├── services/                        # 业务逻辑层（所有核心逻辑在此）
│   ├── ai_service.py                # [核心] 统一 AI 调用入口
│   ├── agent_executor.py            # [核心] Agent 执行引擎（去重 + 关键词检测）
│   ├── prompt_service.py            # Prompt 模板 CRUD + 缓存失效
│   ├── quiz_service.py              # 智能组卷逻辑
│   ├── quiz_paper_service.py        # 试卷生成与管理
│   ├── learning_map_service.py      # 知识图谱生成
│   ├── rag_service.py               # RAG 向量检索（可选，ChromaDB）
│   └── bootstrap_service.py        # 启动时同步种子数据到数据库
├── repositories/                    # 数据访问层（封装 DB 查询，不含业务逻辑）
├── utils/                           # 工具函数
│   ├── model_registry.py            # PROVIDER_TEMPLATES + PROVIDER_ALIASES 工厂
│   ├── agent_tools.py               # Agent 工具定义（web_search 等）
│   ├── file_parser.py               # 文档解析（PDF/DOCX/PPTX/TXT）
│   ├── bootstrap_service.py         # [注意] 部分启动逻辑也在此
│   └── knowledge_parser.py          # 知识库 Markdown + frontmatter 解析
├── seed_data/
│   ├── models.json                  # AI Provider 种子配置（启动时同步到 model_configs 表）
│   ├── prompts.json                 # Prompt 种子数据（启动时同步到 prompts 表）
│   └── PROMPT_DESIGN_GUIDE.md       # [不要动] Prompt 设计规范文档
├── tests/                           # 单元测试（12 个测试文件）
│   └── ...                          # 详见下方"测试文件清单"
├── knowledge_base/                  # RAG 知识库目录（gitignore）
│   ├── corpus/                      # 原始 Markdown 文档（按年级/学科分类）
│   ├── images/                      # 图片池（程序自动复制）
│   └── _index/                      # ChromaDB 向量索引（自动生成）
├── requirements.txt                 # 主依赖
├── requirements-rag.txt             # RAG 可选依赖（chromadb + sentence-transformers）
├── .env                             # 本地环境变量（不提交 git）
└── .env.example                     # 环境变量模板（提交 git）
```

## 关键模块职责速查

### `core/config.py` — 环境变量配置
- 所有 Settings 字段来源于 `.env`，使用 Pydantic BaseSettings 自动读取
- 重要字段：
  - `DATABASE_URL`：MySQL 连接字符串
  - `SECRET_KEY`：JWT 签名密钥
  - `ENCRYPTION_KEY`：API 密钥加密密钥（32字符）
  - `DEFAULT_AI_PROVIDER`：默认 AI Provider 名称
  - `AI_TIMEOUT`：AI 请求超时（秒，默认 120）
  - `AI_DEFAULT_MAX_TOKENS`：默认最大 Token 数（16384）
  - `AUTO_SYNC_SEED_DATA`：是否自动同步种子数据（true/false）
  - `PROMPT_SEED_PATH`：Prompt 种子数据 JSON 路径（相对 backend/ 目录）
  - `MODEL_CONFIG_SEED_PATH`：模型配置种子数据 JSON 路径

### `core/security.py` — 安全模块
- `create_access_token(data)` / `verify_token(token)` — JWT 签发/校验
- `encrypt_secret(plaintext)` / `decrypt_secret(ciphertext)` — API 密钥加密存储
- `get_current_user(token, db)` — 依赖注入：获取当前登录用户
- `get_current_admin(user)` — 依赖注入：校验 admin 权限（仅 role=admin）

### `services/ai_service.py` — 统一 AI 调用入口
- **所有 AI 调用必须通过此文件，禁止直接实例化 Provider**
- 负责：从 DB 加载 Provider 配置、System Prompt 注入、品牌签名替换
- 接口：`ai_service.chat(messages, db, provider=None)` / `ai_service.stream_chat(...)`
- 品牌替换：AI 返回含模型签名时，替换为智学伴标准声明

### `services/agent_executor.py` — Agent 执行引擎
- 核心执行循环：解析 AI 意图 → 调用工具 → 汇总结果
- **去重机制**：80% 相似度检测，避免 AI 重复输出相同内容
- **关键词检测** `_detect_keyword_and_hint()`：强制 AI 调用正确工具
  - 触发词 → 强制工具映射（如"搜索/查一下" → web_search）
- 流式输出：通过 SSE 推送步骤事件到前端

### `utils/model_registry.py` — Provider 工厂
- `PROVIDER_TEMPLATES`：各 Provider 的 base_url、默认 model 等配置模板
- `PROVIDER_ALIASES`：Provider 别名映射（如 `"deepseek"` → `"DeepSeek"`）
- `get_provider(provider_name, api_key, **kwargs)` — 返回 Provider 实例
- 新增 Provider 时：在此文件的两个字典中注册，无需修改其他代码

### `services/bootstrap_service.py` — 启动时种子数据同步
- 触发时机：`AUTO_SYNC_SEED_DATA=true` 时，每次后端启动自动执行
- 同步流程：读取 `seed_data/models.json` → 替换 `${ENV_NAME}` 占位符 → 写入 `model_configs` 表
- **注意**：表名是 `model_configs`（有 's'），不是 `model_config`
- 同样处理 `seed_data/prompts.json` → `prompts` 表
- 修改 JSON 文件后重启后端即可生效，无需手动操作数据库

## 测试文件清单（backend/tests/）

```
tests/
├── __init__.py
├── test_ai_service_async.py          # AIService 异步调用测试（含 mock provider）
├── test_agent_stream.py              # Agent SSE 流式输出测试
├── test_agent_executor_structured.py # Agent 执行引擎结构化测试
├── test_agent_executor_function_calling.py  # Agent 函数调用测试
├── test_bootstrap_service.py         # 种子数据同步测试
├── test_model_registry_providers.py  # Provider 注册工厂测试
├── test_learning_map.py              # 知识图谱生成测试
├── test_quiz_paper_service.py        # 试卷服务测试
├── test_quiz_paper_regeneration.py   # 试卷重新生成测试
├── test_prompt.py                    # Prompt 模板 CRUD 测试
├── test_admin.py                     # 管理后台接口测试
└── test_api_call_repo.py             # API 调用日志仓库测试
```

**测试规范**：
- 测试使用内存 SQLite：`sqlite:///:memory:`（不依赖本地 MySQL）
- AIService 测试必须 mock provider，不真实调用 AI
- 运行命令：`cd backend && pytest tests/ -v`

## 数据库速查

| 表名 | 模型文件 | 用途 |
|------|---------|------|
| `users` | `models/users.py` | 用户账户（含 role 字段） |
| `prompts` | `models/prompts.py` | Prompt 模板（managed by 管理后台） |
| `model_configs` | `models/model_config.py` | AI Provider 配置（加密存储 api_key） |
| `api_call_logs` | `models/api_call_log.py` | AI 调用日志 |
| `knowledge_documents` | `models/knowledge.py` | 知识库文档元数据 |
| `knowledge_chunks` | `models/knowledge.py` | 知识库文档分块 |
| `agent_tasks` | `models/agent_task.py` | Agent 任务记录 |

## 调试命令

```bash
# 启动后端（推荐，含热重载）
cd E:\AI_projects\Web\backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 运行所有测试
pytest tests/ -v

# 运行指定测试文件
pytest tests/test_ai_service_async.py -v

# 检查依赖是否安装
pip list | grep pymysql
pip list | grep chromadb  # RAG 可选

# 查看日志（后端启动后）
# 日志输出到 stdout，生产服务器使用 journalctl
ssh root@47.114.79.49 "journalctl -u zhixueban-backend -n 50 --no-pager"
```

## 种子数据修改流程

1. 编辑 `seed_data/models.json` 或 `seed_data/prompts.json`
2. `${DEEPSEEK_API_KEY}` 等占位符会在启动时自动从 `.env` 读取替换
3. 重启后端：
   - 本地：重启 uvicorn 进程
   - 生产：`ssh root@47.114.79.49 "systemctl restart zhixueban-backend"`
4. 检查日志中出现 `[OK] 种子数据同步完成` 即成功
