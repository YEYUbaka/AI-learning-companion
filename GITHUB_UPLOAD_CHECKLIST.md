# GitHub 上传文件清单

本文档列出了需要上传到 GitHub 的文件和目录，以及需要排除的文件。

## ✅ 需要上传的文件和目录

### 根目录
- ✅ `README.md` - 项目说明文档
- ✅ `LICENSE` - MIT 许可证
- ✅ `.gitignore` - Git 忽略规则
- ✅ `docker-compose.yml` - Docker 编排配置
- ✅ `.env.example` - 环境变量模板（需手动创建）

### backend/ 目录
- ✅ `main.py` - FastAPI 应用入口
- ✅ `database.py` - 数据库配置
- ✅ `requirements.txt` - Python 依赖
- ✅ `Dockerfile` - Docker 镜像配置
- ✅ `core/` - 核心模块（config.py, security.py, logger.py 等）
- ✅ `models/` - 数据模型
- ✅ `routers/` - API 路由
- ✅ `services/` - 业务逻辑层
- ✅ `repositories/` - 数据访问层
- ✅ `schemas/` - Pydantic 模型
- ✅ `utils/` - 工具函数
- ✅ `seed_data/` - 种子数据（JSON 文件）
- ✅ `tests/` - 单元测试
- ✅ `README.md` - 后端说明文档

### frontend/ 目录
- ✅ `package.json` - Node.js 依赖
- ✅ `package-lock.json` - 依赖锁定文件
- ✅ `vite.config.js` - Vite 配置
- ✅ `tailwind.config.js` - TailwindCSS 配置
- ✅ `postcss.config.js` - PostCSS 配置
- ✅ `index.html` - HTML 入口
- ✅ `nginx.conf` - Nginx 配置（生产环境）
- ✅ `Dockerfile` - Docker 镜像配置
- ✅ `src/` - 源代码目录
  - ✅ `pages/` - 页面组件
  - ✅ `components/` - 通用组件
  - ✅ `api/` - API 客户端
  - ✅ `store/` - 状态管理
  - ✅ `utils/` - 工具函数
  - ✅ `main.jsx` - 入口文件
  - ✅ `App.jsx` - 主应用组件
- ✅ `README.md` - 前端说明文档

### docs/ 目录（可选）
- ✅ `architecture.md` - 架构文档

## ❌ 需要排除的文件和目录

### 虚拟环境和依赖
- ❌ `backend/venv/` - Python 虚拟环境
- ❌ `backend/.venv/` - Python 虚拟环境
- ❌ `frontend/node_modules/` - Node.js 依赖包
- ❌ `.venv/` - 根目录虚拟环境

### 数据库和日志
- ❌ `backend/zhixueban.db` - SQLite 数据库文件
- ❌ `backend/*.db` - 所有数据库文件
- ❌ `logs/` - 日志文件目录
- ❌ `backend/logs/` - 后端日志

### 上传文件和报告
- ❌ `uploads/` - 上传文件目录
- ❌ `backend/uploads/` - 后端上传文件
- ❌ `backend/reports/` - 生成的报告文件

### 构建产物
- ❌ `frontend/dist/` - 前端构建产物
- ❌ `backend/dist/` - 后端构建产物
- ❌ `__pycache__/` - Python 缓存
- ❌ `*.pyc`, `*.pyo` - Python 编译文件

### 环境变量和配置
- ❌ `.env` - 环境变量文件（包含敏感信息）
- ❌ `.env.local` - 本地环境变量

### 临时和测试文件
- ❌ `backend/test_*.py` - 测试脚本
- ❌ `backend/test_*.pdf` - 测试 PDF
- ❌ `backend/*.md` - 后端临时文档（已排除）
- ❌ `backend/快速*.py` - 快速测试脚本
- ❌ `backend/测试*.py` - 测试脚本
- ❌ `backend/诊断*.py` - 诊断脚本
- ❌ `dummy` - 临时文件
- ❌ `query` - 临时文件

### 部署脚本（本地使用）
- ❌ `*.bat` - Windows 批处理脚本
- ❌ `部署脚本/` - 部署脚本目录

### IDE 和系统文件
- ❌ `.vscode/` - VS Code 配置
- ❌ `.idea/` - IntelliJ IDEA 配置
- ❌ `.cursor/` - Cursor IDE 配置
- ❌ `.DS_Store` - macOS 系统文件
- ❌ `*.swp`, `*.swo` - Vim 临时文件

### 压缩包和文档
- ❌ `Web4.zip` - 压缩包
- ❌ `documents/` - 文档目录（包含参赛材料，可选排除）
- ❌ `智学伴_AI个性化学习平台/` - 备份目录

### 其他
- ❌ `.pytest_cache/` - pytest 缓存
- ❌ `.coverage` - 测试覆盖率文件
- ❌ `htmlcov/` - HTML 覆盖率报告

## 📝 上传前检查清单

在提交到 GitHub 之前，请确认：

1. ✅ 已创建 `.env.example` 文件（包含所有必要的环境变量，但不包含真实密钥）
2. ✅ 已检查 `.gitignore` 文件，确保敏感文件被排除
3. ✅ 已删除或排除所有 `.env` 文件
4. ✅ 已删除或排除所有数据库文件（`.db`）
5. ✅ 已删除或排除所有日志文件
6. ✅ 已删除或排除所有上传文件
7. ✅ 已删除或排除所有虚拟环境和 `node_modules`
8. ✅ 已检查代码中是否包含硬编码的密钥或敏感信息
9. ✅ 已确认 `README.md` 中的信息准确无误
10. ✅ 已确认 LICENSE 文件存在

## 🚀 上传步骤

1. **初始化 Git 仓库**（如果还没有）：
   ```bash
   git init
   ```

2. **添加文件**：
   ```bash
   git add .
   ```

3. **检查状态**：
   ```bash
   git status
   ```
   确认没有敏感文件被添加

4. **提交**：
   ```bash
   git commit -m "Initial commit: 智学伴 AI个性化学习平台"
   ```

5. **创建 GitHub 仓库并推送**：
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

## ⚠️ 安全提醒

- **永远不要**提交包含真实 API 密钥的 `.env` 文件
- **永远不要**提交数据库文件（可能包含用户数据）
- **永远不要**提交日志文件（可能包含敏感信息）
- 确保所有默认密钥在 `.env.example` 中都有明确标注需要修改

## 📋 手动创建 .env.example

如果 `.env.example` 文件无法自动创建，请手动创建并包含以下内容：

```env
# 数据库配置
DATABASE_URL=sqlite:///./zhixueban.db

# JWT 配置（生产环境必须修改）
SECRET_KEY=your-secret-key-change-in-production
ENCRYPTION_KEY=default-encryption-key-change-in-production

# AI 配置
DEFAULT_AI_PROVIDER=deepseek
AI_TIMEOUT=120
AI_MAX_RETRIES=3

# 文件上传配置
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE=10485760

# 日志配置
LOG_DIR=logs
LOG_LEVEL=INFO

# CORS 配置
CORS_ORIGINS=*

# 种子数据同步
AUTO_SYNC_SEED_DATA=true
PROMPT_SEED_PATH=backend/seed_data/prompts.json
MODEL_CONFIG_SEED_PATH=backend/seed_data/models.json
```

