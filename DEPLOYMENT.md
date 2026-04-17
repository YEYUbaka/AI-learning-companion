# 部署环境对照手册

> 本文档专门区分**本地开发环境**与**生产服务器环境**，避免操作混淆。  
> 根目录 `CLAUDE.md` 中的架构规范仍然有效。

---

## 环境对照总表

| 项目 | 本地开发 | 生产服务器 |
|------|---------|----------|
| **后端地址** | http://127.0.0.1:8000 | http://47.114.79.49（Nginx 80 端口） |
| **前端地址** | http://localhost:5173（或 5174） | http://47.114.79.49 |
| **后端代码路径** | `E:\AI_projects\Web\backend\` | `/opt/zhixueban/backend/` |
| **前端代码路径** | `E:\AI_projects\Web\frontend\` | `/opt/zhixueban/frontend/` |
| **后端启动方式** | `uvicorn main:app --reload` | `systemctl restart zhixueban-backend` |
| **前端访问方式** | Vite 开发服务器（热更新） | Nginx 服务静态文件（需先 `npm run build`） |
| **Nginx** | 无（直接访问 Vite） | `/etc/nginx/` 由 systemctl 管理 |
| **数据库** | `localhost:3306` → `zhixueban` | 服务器内 MySQL，同端口同库名 |
| **环境变量** | `backend/.env`（本地配置，不提交 git） | 服务器 `/opt/zhixueban/backend/.env`（含真实密钥） |
| **日志查看** | uvicorn 终端输出（stdout） | `journalctl -u zhixueban-backend -n 50 --no-pager` |

---

## 本地开发环境

### 启动后端

```bash
cd E:\AI_projects\Web\backend
python -m venv venv
venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- 访问：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/health
- **注意**：使用 `--reload` 热重载，不要用 `python main.py`

### 启动前端

```bash
cd E:\AI_projects\Web\frontend
npm install
npm run dev
```

- 访问：http://localhost:5173（端口被占用时自动切换到 5174）
- Vite 热更新，修改代码后自动刷新
- 结构性修改（路由/导入）后需 Ctrl+Shift+R 强制刷新

### 一键启动

```bash
# 项目根目录
5-一键启动前后端.bat
```

### 本地测试

```bash
cd E:\AI_projects\Web\backend
pytest tests/ -v                         # 运行所有测试
pytest tests/test_ai_service_async.py -v # 运行指定测试文件
```

---

## 生产服务器环境

### 服务器信息

| 项目 | 值 |
|------|---|
| IP | `47.114.79.49` |
| SSH 登录 | `ssh root@47.114.79.49` |
| 后端路径 | `/opt/zhixueban/backend/` |
| 前端路径 | `/opt/zhixueban/frontend/` |

### 服务管理命令

```bash
# 重启后端
ssh root@47.114.79.49 "systemctl restart zhixueban-backend"

# 查看后端状态
ssh root@47.114.79.49 "systemctl status zhixueban-backend"

# 查看后端日志（最近 50 行）
ssh root@47.114.79.49 "journalctl -u zhixueban-backend -n 50 --no-pager"

# 重载 Nginx（修改 nginx.conf 后需执行）
ssh root@47.114.79.49 "systemctl reload nginx"

# 查看 Nginx 状态
ssh root@47.114.79.49 "systemctl status nginx"
```

---

## 代码同步流程（本地 → 生产）

### 同步单个后端文件

```bash
# 替换 <relative_path> 为相对于 backend/ 的路径，例如 services/ai_service.py
scp E:\AI_projects\Web\backend\<relative_path> root@47.114.79.49:/opt/zhixueban/backend/<relative_path>

# 同步后重启后端
ssh root@47.114.79.49 "systemctl restart zhixueban-backend"

# 确认重启成功（看到 active (running) 即可）
ssh root@47.114.79.49 "systemctl status zhixueban-backend --no-pager"
```

**示例**：

```bash
scp E:\AI_projects\Web\backend\services\agent_executor.py root@47.114.79.49:/opt/zhixueban/backend/services/agent_executor.py
ssh root@47.114.79.49 "systemctl restart zhixueban-backend"
```

### 同步前端文件（需重新构建）

```bash
# 1. 同步源文件
scp E:\AI_projects\Web\frontend\src\<relative_path> root@47.114.79.49:/opt/zhixueban/frontend/src/<relative_path>

# 2. 在服务器上重新构建（构建产物由 Nginx 提供）
ssh root@47.114.79.49 "cd /opt/zhixueban/frontend && npm run build"
```

**示例**：

```bash
scp E:\AI_projects\Web\frontend\src\pages\AgentChat.jsx root@47.114.79.49:/opt/zhixueban/frontend/src/pages/AgentChat.jsx
ssh root@47.114.79.49 "cd /opt/zhixueban/frontend && npm run build"
```

### 同步多个文件（使用 scp -r 递归）

```bash
# 同步整个 services 目录
scp -r E:\AI_projects\Web\backend\services\ root@47.114.79.49:/opt/zhixueban/backend/services/
ssh root@47.114.79.49 "systemctl restart zhixueban-backend"

# 同步整个前端 src 目录并重新构建
scp -r E:\AI_projects\Web\frontend\src\ root@47.114.79.49:/opt/zhixueban/frontend/src/
ssh root@47.114.79.49 "cd /opt/zhixueban/frontend && npm run build"
```

### 同步种子数据

```bash
# 同步 models.json（AI Provider 配置）
scp E:\AI_projects\Web\backend\seed_data\models.json root@47.114.79.49:/opt/zhixueban/backend/seed_data/models.json
ssh root@47.114.79.49 "systemctl restart zhixueban-backend"
# 日志中出现 "[OK] 种子数据同步完成" 即成功
```

---

## 生产环境 Nginx 配置说明

Nginx 配置位于前端目录：`frontend/nginx.conf`

关键配置块：

| 配置块 | 说明 |
|--------|------|
| `location /` | SPA fallback，所有路径返回 index.html |
| `location = /api/agent/task/stream` | **SSE 专用块**：`proxy_buffering off`、`gzip off`、超时 3600s |
| `location /api` | 普通 API 反代，超时 300s |

**修改 nginx.conf 后**：

```bash
# 先同步文件（nginx.conf 在生产机器哪里需根据实际部署调整）
ssh root@47.114.79.49 "systemctl reload nginx"
```

---

## 关键注意事项

1. **生产服务器 `.env` 含真实 API Key，严禁提交到 git**
   - 本地 `.env` 与服务器 `.env` 内容可能不同（不同的 API Key）
   - `.gitignore` 已忽略 `.env`，但每次提交前检查 `git status`

2. **种子数据自动同步**
   - 修改 `seed_data/models.json` 或 `seed_data/prompts.json` 后
   - 重启后端（本地或服务器）会自动同步到数据库 `model_configs` / `prompts` 表
   - 注意：表名是 `model_configs`（有 s），不是 `model_config`

3. **前端变更必须重新构建**
   - 生产环境 Nginx 服务的是 `frontend/dist/` 目录的静态文件
   - 修改源码后必须执行 `npm run build`，否则生产环境看不到变化
   - 本地开发使用 Vite 热更新，无需手动构建

4. **后端 SSE 接口特殊处理**
   - `/api/agent/task/stream` 必须走 Nginx 的专用 location 块（`proxy_buffering off`）
   - 本地开发时 `agentApi.js` 直连 8000 端口（跳过 Nginx）
   - 生产环境走 Nginx 反代（相对路径 `/api/agent/task/stream`）

5. **数据库同步**
   - 生产和本地使用独立的 MySQL 实例，数据不互通
   - 数据库名均为 `zhixueban`，但数据内容独立

---

## 快速参考卡

```
[本地]
  后端: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  前端: npm run dev  → http://localhost:5173
  测试: cd backend && pytest tests/ -v

[生产同步]
  后端: scp <file> root@47.114.79.49:/opt/zhixueban/backend/<path>
        ssh root@47.114.79.49 "systemctl restart zhixueban-backend"
  前端: scp <file> root@47.114.79.49:/opt/zhixueban/frontend/src/<path>
        ssh root@47.114.79.49 "cd /opt/zhixueban/frontend && npm run build"

[生产日志]
  后端: ssh root@47.114.79.49 "journalctl -u zhixueban-backend -n 50 --no-pager"
  Nginx: ssh root@47.114.79.49 "systemctl reload nginx"
```
