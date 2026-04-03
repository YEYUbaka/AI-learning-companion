# 智学伴项目启动清单

> 本文档提供完整的项目启动步骤，适用于 Windows 环境。

---

## 一、前置环境检查

在开始之前，请确认以下环境已安装：

| 环境 | 最低版本 | 检查命令 | 状态 |
|------|----------|----------|------|
| Python | 3.9+ | `python --version` | [ ] |
| Node.js | 18+ | `node --version` | [ ] |
| MySQL | 5.7+ | `mysql --version` | [ ] |
| Git | 2.0+ | `git --version` | [ ] |

---

## 二、数据库准备

### 1. 启动 MySQL 服务

```bash
# Windows 服务管理器中启动 MySQL
# 或使用命令行：
net start MySQL
```

### 2. 创建数据库

```sql
CREATE DATABASE zhixueban CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 验证数据库

```bash
mysql -u root -p -e "SHOW DATABASES;" | findstr zhixueban
```

---

## 三、后端启动

### 1. 进入后端目录

```bash
cd E:\AI_projects\Web\backend
```

### 2. 创建虚拟环境（首次运行）

```bash
python -m venv venv
```

### 3. 激活虚拟环境

```bash
venv\Scripts\activate
```

### 4. 安装依赖

```bash
pip install -r requirements.txt
```

### 5. 配置环境变量

复制 `.env.example` 为 `.env`，并修改以下必填项：

```bash
# 数据库连接（必填）
DATABASE_URL=mysql+pymysql://root:你的密码@localhost:3306/zhixueban?charset=utf8mb4

# JWT 密钥（生产环境必须修改）
SECRET_KEY=你的随机密钥

# 加密密钥（生产环境必须修改）
ENCRYPTION_KEY=你的32位加密密钥

# 默认 AI 提供商
DEFAULT_AI_PROVIDER=deepseek
```

### 6. 启动后端服务

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 7. 验证后端

打开浏览器访问：
- **API 文档**: http://127.0.0.1:8000/docs
- **健康检查**: http://127.0.0.1:8000/health

看到 Swagger UI 页面即表示后端启动成功。

---

## 四、前端启动

### 1. 打开新终端，进入前端目录

```bash
cd E:\AI_projects\Web\frontend
```

### 2. 安装依赖（首次运行）

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 验证前端

打开浏览器访问：**http://localhost:5173**

看到登录页面即表示前端启动成功。

---

## 五、完整启动验证清单

启动完成后，逐项验证：

| 验证项 | 检查方式 | 预期结果 | 状态 |
|--------|----------|----------|------|
| MySQL 运行中 | `mysql -u root -p -e "SELECT 1;"` | 返回 1 | [ ] |
| 后端 API 文档 | 访问 http://127.0.0.1:8000/docs | 显示 Swagger UI | [ ] |
| 后端健康检查 | 访问 http://127.0.0.1:8000/health | 返回 JSON | [ ] |
| 前端页面 | 访问 http://localhost:5173 | 显示登录页 | [ ] |
| 数据库表 | 后端启动日志 | 显示「数据库表创建成功」 | [ ] |
| AI 提供商 | 后端启动日志 | 显示已注册的提供商列表 | [ ] |

---

## 六、快速启动（一键脚本）

项目根目录提供了批处理文件，可一键启动前后端：

```bash
# 项目根目录执行
启动服务.bat
```

---

## 七、常见问题排查

### 后端启动失败

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| `ModuleNotFoundError` | 依赖未安装 | 运行 `pip install -r requirements.txt` |
| `Access denied for user` | 数据库密码错误 | 检查 `.env` 中的 `DATABASE_URL` |
| `Unknown database` | 数据库未创建 | 执行 `CREATE DATABASE zhixueban` |
| 端口被占用 | 8000 端口已被占用 | 修改启动命令的 `--port` 参数 |

### 前端启动失败

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| `Cannot find module` | 依赖未安装 | 运行 `npm install` |
| 端口被占用 | 5173 端口已被占用 | Vite 会自动切换端口，查看终端输出 |
| 页面空白 | 后端未启动 | 先启动后端服务 |

---

## 八、RAG 知识库（可选）

如需启用 RAG 知识库功能：

```bash
cd E:\AI_projects\Web\backend
pip install -r requirements-rag.txt
```

不安装 RAG 依赖不影响后端正常启动，RAG 功能会自动禁用。

---

## 九、管理后台首次访问

1. 启动后端后，查看启动日志中的临时管理员 Token
2. 访问 http://localhost:5173/admin
3. 使用 Token 登录
4. 建议首次登录后创建正式管理员账户

---

## 十、停止服务

- **后端**: 在终端中按 `Ctrl+C`
- **前端**: 在终端中按 `Ctrl+C`
- **MySQL**: `net stop MySQL`（可选）
