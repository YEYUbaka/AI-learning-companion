# Windows 云服务器部署指南

## 📋 部署前准备

### 1. 服务器环境要求
- **操作系统**: Windows Server 2016/2019/2022 或 Windows 10/11
- **Python**: 3.10 或更高版本（推荐 3.11+）
- **Node.js**: 18.x 或更高版本（推荐 20.x）
- **内存**: 至少 4GB（推荐 8GB+）
- **磁盘**: 至少 20GB 可用空间

### 2. 需要安装的软件
- Python 3.11+ (64位)
- Node.js 20.x (LTS版本)
- Git (可选，用于代码管理)

---

## 🚀 部署步骤

### 第一步：上传项目文件

1. **将项目文件上传到服务器**
   - 可以使用 FTP、RDP 远程桌面、或 Git 克隆
   - 建议上传到：`C:\zhixueban\` 或 `D:\zhixueban\`

2. **项目目录结构**
   ```
   zhixueban/
   ├── backend/          # 后端代码
   ├── frontend/         # 前端代码
   ├── 部署脚本/         # 部署相关脚本
   └── README.md
   ```

### 第二步：配置后端环境

#### 2.1 安装 Python 依赖

1. **打开 PowerShell 或 CMD**，进入后端目录：
   ```powershell
   cd C:\zhixueban\backend
   ```

2. **创建虚拟环境**：
   ```powershell
   python -m venv venv
   ```

3. **激活虚拟环境**：
   ```powershell
   .\venv\Scripts\activate
   ```

4. **安装依赖**：
   ```powershell
   pip install -r requirements.txt
   ```

#### 2.2 配置环境变量

1. **创建 `.env` 文件**（在 `backend` 目录下）：
   ```env
   # 数据库配置
   DATABASE_URL=sqlite:///./zhixueban.db
   
   # JWT密钥（运行 generate_keys.py 生成）
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   
   # AI模型配置（根据实际情况填写）
   DEEPSEEK_API_KEY=your-deepseek-api-key
   OPENAI_API_KEY=your-openai-api-key
   SPARK_API_KEY=your-spark-api-key
   SPARK_API_SECRET=your-spark-api-secret
   SPARK_APP_ID=your-spark-app-id
   
   # 服务器配置
   BACKEND_HOST=0.0.0.0
   BACKEND_PORT=8000
   ```

2. **生成 JWT 密钥**（如果还没有）：
   ```powershell
   python generate_keys.py
   ```

#### 2.3 初始化数据库

```powershell
python -c "from database import engine, Base; Base.metadata.create_all(bind=engine)"
```

### 第三步：配置前端环境

#### 3.1 安装 Node.js 依赖

1. **进入前端目录**：
   ```powershell
   cd C:\zhixueban\frontend
   ```

2. **安装依赖**：
   ```powershell
   npm install
   ```

#### 3.2 配置 API 地址

1. **编辑 `frontend/src/api/apiClient.js`**，修改后端 API 地址：
   ```javascript
   const API_BASE_URL = 'http://your-server-ip:8000/api/v1';
   // 或者使用域名
   // const API_BASE_URL = 'https://your-domain.com/api/v1';
   ```

2. **构建前端**：
   ```powershell
   npm run build
   ```

### 第四步：配置防火墙

1. **打开 Windows 防火墙设置**
   - 控制面板 → 系统和安全 → Windows Defender 防火墙

2. **添加入站规则**
   - 允许端口 `8000`（后端 API）
   - 允许端口 `5173`（前端开发服务器，如果使用）
   - 允许端口 `80` 或 `443`（如果使用 Nginx 等反向代理）

---

## 🎯 启动服务

### 方式一：使用批处理脚本（推荐）

#### 启动后端服务

创建 `启动后端服务.bat`：
```batch
@echo off
cd /d C:\zhixueban\backend
call venv\Scripts\activate.bat
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
```

#### 启动前端服务（开发模式）

创建 `启动前端服务.bat`：
```batch
@echo off
cd /d C:\zhixueban\frontend
npm run dev -- --host 0.0.0.0
pause
```

#### 启动前端服务（生产模式 - 使用 Nginx）

如果使用 Nginx 作为反向代理，需要：
1. 安装 Nginx for Windows
2. 配置 Nginx 指向前端 `dist` 目录
3. 配置反向代理到后端 API

### 方式二：使用 Windows 服务（推荐生产环境）

#### 使用 NSSM 将服务注册为 Windows 服务

1. **下载 NSSM** (Non-Sucking Service Manager)
   - 下载地址：https://nssm.cc/download

2. **注册后端服务**：
   ```powershell
   nssm install ZhixuebanBackend "C:\zhixueban\backend\venv\Scripts\python.exe" "-m uvicorn main:app --host 0.0.0.0 --port 8000"
   nssm set ZhixuebanBackend AppDirectory "C:\zhixueban\backend"
   nssm start ZhixuebanBackend
   ```

3. **注册前端服务**（如果使用 Node.js 运行）：
   ```powershell
   nssm install ZhixuebanFrontend "C:\Program Files\nodejs\node.exe" "C:\zhixueban\frontend\node_modules\.bin\vite.cmd --host 0.0.0.0"
   nssm set ZhixuebanFrontend AppDirectory "C:\zhixueban\frontend"
   nssm start ZhixuebanFrontend
   ```

---

## 🔧 生产环境优化

### 1. 使用 Nginx 作为反向代理

#### Nginx 配置示例 (`nginx.conf`)：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root C:/zhixueban/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. 配置 HTTPS（推荐）

1. **申请 SSL 证书**（Let's Encrypt 或商业证书）
2. **配置 Nginx 支持 HTTPS**
3. **更新前端 API 地址为 HTTPS**

### 3. 数据库备份

创建定期备份脚本 `备份数据库.bat`：
```batch
@echo off
set BACKUP_DIR=C:\zhixueban\backups
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%
mkdir %BACKUP_DIR% 2>nul
copy C:\zhixueban\backend\zhixueban.db %BACKUP_DIR%\zhixueban_%DATE%.db
echo 数据库备份完成: %BACKUP_DIR%\zhixueban_%DATE%.db
```

---

## 📝 验证部署

### 1. 检查后端服务

在浏览器访问：`http://your-server-ip:8000/docs`
- 应该能看到 FastAPI 的 Swagger 文档界面

### 2. 检查前端服务

在浏览器访问：`http://your-server-ip:5173`（开发模式）
或 `http://your-server-ip`（生产模式，通过 Nginx）

### 3. 测试 API

```powershell
# 测试健康检查
curl http://your-server-ip:8000/api/v1/health

# 测试用户注册
curl -X POST http://your-server-ip:8000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"username\":\"test\",\"password\":\"test123\",\"email\":\"test@example.com\"}"
```

---

## 🐛 常见问题

### 1. 端口被占用

**问题**: `Address already in use`

**解决**:
```powershell
# 查看端口占用
netstat -ano | findstr :8000

# 结束进程
taskkill /PID <进程ID> /F
```

### 2. 虚拟环境激活失败

**问题**: `无法加载文件，因为在此系统上禁止运行脚本`

**解决**:
```powershell
# 以管理员身份运行 PowerShell，执行：
Set-ExecutionPolicy RemoteSigned
```

### 3. 前端构建失败

**问题**: `npm install` 或 `npm run build` 失败

**解决**:
```powershell
# 清除缓存
npm cache clean --force

# 删除 node_modules 重新安装
rmdir /s /q node_modules
npm install
```

### 4. 数据库连接失败

**问题**: 无法连接数据库

**解决**:
- 检查 `backend/.env` 中的 `DATABASE_URL`
- 确保数据库文件有写入权限
- 检查磁盘空间是否充足

---

## 📞 技术支持

如遇到问题，请检查：
1. 后端日志：`backend/logs/app_*.log`
2. 错误日志：`backend/logs/error_*.log`
3. Windows 事件查看器

---

## 🔄 更新部署

### 更新后端代码

```powershell
cd C:\zhixueban\backend
.\venv\Scripts\activate
pip install -r requirements.txt --upgrade
# 重启服务
```

### 更新前端代码

```powershell
cd C:\zhixueban\frontend
npm install
npm run build
# 重启 Nginx 或前端服务
```

---

## ✅ 部署检查清单

- [ ] Python 3.11+ 已安装
- [ ] Node.js 20.x 已安装
- [ ] 后端虚拟环境已创建并激活
- [ ] 后端依赖已安装
- [ ] `.env` 文件已配置
- [ ] 数据库已初始化
- [ ] 前端依赖已安装
- [ ] 前端已构建（生产模式）
- [ ] API 地址已配置
- [ ] 防火墙端口已开放
- [ ] 后端服务已启动
- [ ] 前端服务已启动
- [ ] 可以访问 API 文档
- [ ] 可以访问前端页面
- [ ] 用户注册/登录功能正常

---

**部署完成后，您的智学伴平台就可以通过外网访问了！** 🎉

