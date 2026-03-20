# 本地联调运行手册（前后端完整）

本文档用于在本地完整启动后端 + 前端，快速预览页面改动。

## 1. 前置条件

- 已安装 Python（建议 3.10+）
- 已安装 Node.js（建议 18+）
- MySQL 已启动且可连接
- 后端已准备 `backend/.env`（可由 `.env.example` 复制）

## 2. 启动后端（端口 8000）

```powershell
cd backend
venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

健康检查：

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing
```

## 3. 启动前端（端口 5173）

```powershell
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

访问地址：

- 前端页面：`http://localhost:5173`
- 后端 Swagger：`http://localhost:8000/docs`
- 后端健康检查：`http://localhost:8000/health`

## 4. 后台启动（可选）

如果你希望后台运行并落日志，可以使用 `Start-Process`：

```powershell
# backend
Start-Process -FilePath ".\backend\venv\Scripts\python.exe" `
  -ArgumentList @("-m","uvicorn","main:app","--host","0.0.0.0","--port","8000","--reload") `
  -WorkingDirectory ".\backend"

# frontend
Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run","dev","--","--host","0.0.0.0","--port","5173") `
  -WorkingDirectory ".\frontend"
```

## 5. 停止服务

先查端口对应 PID：

```powershell
netstat -ano | Select-String ":8000|:5173"
```

再结束进程：

```powershell
taskkill /PID <pid> /F
```
