# 🔧 前端API配置说明

## 问题原因

前端请求发送到了远程服务器 `http://47.114.103.200:8000`，而不是本地后端 `http://127.0.0.1:8000`。

这是因为前端有 `.env.development` 文件配置了 `VITE_API_BASE=http://47.114.103.200:8000`。

## ✅ 已修复

已将 `.env.development` 文件中的API地址改为本地：
```
VITE_API_BASE=http://127.0.0.1:8000
```

## 🔄 需要重启前端

修改环境变量后，**必须重启前端开发服务器**才能生效：

1. 停止前端服务（在运行前端的终端按 `Ctrl+C`）
2. 重新启动前端：
   ```powershell
   cd frontend
   npm run dev
   ```

## 📝 环境变量优先级

Vite的环境变量优先级（从高到低）：
1. `.env.local` - 本地覆盖（通常不提交到Git）
2. `.env.development` - 开发环境（当前使用）
3. `.env` - 默认配置

## 🎯 使用场景

### 开发环境（本地测试）
```env
VITE_API_BASE=http://127.0.0.1:8000
```

### 生产环境（连接远程服务器）
```env
VITE_API_BASE=http://47.114.103.200:8000
```

## ⚠️ 重要提示

- 修改 `.env.development` 后必须重启前端服务
- 如果同时有 `.env.local` 文件，它会覆盖 `.env.development` 的配置
- 确保本地后端服务正在运行（`http://127.0.0.1:8000`）

