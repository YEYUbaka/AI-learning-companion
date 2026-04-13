# 智学伴 AI 学习平台

智学伴是一个面向学习场景的全栈应用，当前版本包含登录注册、智能助手、学习计划、文件上传、AI 测评、知识图谱和管理后台。

## 当前入口

- 前端登录页：`http://127.0.0.1:5173/login`
- 后端文档：`http://127.0.0.1:8000/docs`
- 健康检查：`http://127.0.0.1:8000/health`

当前前端真实路由以 `frontend/src/App.jsx` 为准：

- 访客与认证：`/login`、`/register`
- 普通用户：`/dashboard`、`/agent`、`/study-plan`、`/upload-file`、`/quiz`、`/quiz-result`、`/learning-map`、`/change-password`
- 管理后台：`/admin/dashboard`、`/admin/models`、`/admin/prompts`、`/admin/config`、`/admin/users`、`/admin/api-logs`、`/admin/knowledge`

## 技术栈

- 后端：FastAPI、SQLAlchemy、MySQL、Pydantic、JWT
- 前端：React 18、Vite、React Router、TailwindCSS、Zustand
- 可选能力：RAG 依赖见 `backend/requirements-rag.txt`

## 环境要求

- Python 3.10+
- Node.js 18+
- MySQL 8.0+

## 快速启动

### 后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### Windows 一键启动

```powershell
scripts\start\5-一键启动前后端.bat
```

## 认证与密码策略

### 最小合法规则

- 长度 `6-50`
- 不允许空格
- 注册、自助改密、管理员代改都只按这套规则拦截

### 强度提示

- 弱：满足最小合法规则，但长度较短或字符种类较少
- 中：`8+` 且至少两类字符组合
- 强：`8+` 且同时包含大写、小写、数字、特殊字符

### 重要行为

- 前端只把认证信息存入 `sessionStorage`
- 后端管理员鉴权只认数据库 `role == 'admin'`
- 前端管理员放行只认 `sessionStorage.userInfo.role === 'admin'`
- 自助改密接口：`POST /api/v1/auth/change-password`
- 管理员代改接口：`PUT /api/v1/admin/users/{user_id}/password`
- 用户改密、管理员代改、全量重置都会递增 `users.token_version`，旧 JWT 会立即失效

## 全量密码重置

由于数据库只保存 `hashed_password`，无法可靠识别“哪些账号曾经使用弱密码”，当前方案为按需全量重置所有用户密码。

### 使用方式

```bash
cd backend
python scripts/reset_all_user_passwords.py --password "YourStrongPass!9"
```

也可以通过环境变量提供：

```bash
set BULK_RESET_DEFAULT_PASSWORD=YourStrongPass!9
python scripts/reset_all_user_passwords.py
```

### 约束

- 统一默认密码不会写入仓库
- 统一默认密码必须达到“强”级别
- 执行后所有旧登录态立即失效

## Git 提醒 Hook

仓库内置了提交后提醒 hook。它不会自动 push，只会在存在未推送提交时提示执行 `git push origin HEAD`。

### 安装

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup\install-git-hooks.ps1
```

### 启用效果

- 每次 `git commit` 后检查当前分支是否有未推送提交
- 有则输出 `[WARNING]` 提示
- 不依赖 `gh`
- 不自动执行远端推送

## 测试

### 后端

```bash
cd backend
pytest
```

### 前端构建检查

```bash
cd frontend
npm run build
```

### 手工测试

完整手工测试用例见：

- `docs/手动测试用例.md`
- `docs/测试账号.md`

## 目录说明

```text
backend/
  main.py
  routers/
  services/
  repositories/
  models/
  schemas/
  scripts/
frontend/
  src/
docs/
scripts/
```

## 说明

- `backend/.env` 不入库，请基于 `backend/.env.example` 创建
- 种子数据位于 `backend/seed_data/`
- 上传文件位于 `backend/uploads/`
- 报告文件位于 `backend/reports/`
