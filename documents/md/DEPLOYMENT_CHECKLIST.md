# 智学伴 v2.0 部署检查清单

## ✅ 已创建的文件清单

### 后端核心模块
- [x] `backend/core/__init__.py`
- [x] `backend/core/config.py` - 配置管理
- [x] `backend/core/security.py` - 安全模块（JWT、加密）
- [x] `backend/core/logger.py` - 日志模块

### 数据库模型
- [x] `backend/models/base.py` - 基础模型
- [x] `backend/models/prompt.py` - Prompt模型
- [x] `backend/models/model_config.py` - 模型配置模型
- [x] `backend/models/users.py` - 已更新（添加role字段）
- [x] `backend/models/__init__.py` - 已更新

### Schemas层
- [x] `backend/schemas/__init__.py`
- [x] `backend/schemas/auth.py` - 认证Schemas
- [x] `backend/schemas/ai.py` - AI相关Schemas
- [x] `backend/schemas/quiz.py` - 测验Schemas
- [x] `backend/schemas/admin.py` - 管理后台Schemas

### Repositories层
- [x] `backend/repositories/__init__.py`
- [x] `backend/repositories/user_repo.py` - 用户数据访问
- [x] `backend/repositories/prompt_repo.py` - Prompt数据访问
- [x] `backend/repositories/model_config_repo.py` - 模型配置数据访问

### Services层
- [x] `backend/services/__init__.py`
- [x] `backend/services/auth_service.py` - 认证服务
- [x] `backend/services/ai_service.py` - AI服务
- [x] `backend/services/prompt_service.py` - Prompt服务
- [x] `backend/services/admin_service.py` - 管理后台服务
- [x] `backend/services/quiz_service.py` - 测验服务

### Utils工具
- [x] `backend/utils/model_registry.py` - 模型注册表
- [x] `backend/utils/markdown_sanitizer.py` - 文本清理工具

### 路由
- [x] `backend/routers/admin.py` - 管理后台路由
- [x] `backend/main.py` - 已更新（注册admin路由）

### 测试
- [x] `backend/tests/__init__.py`
- [x] `backend/tests/test_prompt.py` - Prompt测试
- [x] `backend/tests/test_admin.py` - 管理后台测试

### 前端组件
- [x] `frontend/src/components/AdminLayout.jsx` - 管理后台布局
- [x] `frontend/src/components/AdminProtectedRoute.jsx` - 管理员路由保护
- [x] `frontend/src/pages/Admin/Dashboard.jsx` - 仪表盘
- [x] `frontend/src/pages/Admin/ModelManagement.jsx` - 模型管理
- [x] `frontend/src/pages/Admin/PromptEditor.jsx` - Prompt编辑器
- [x] `frontend/src/pages/Admin/SystemConfig.jsx` - 系统配置
- [x] `frontend/src/App.jsx` - 已更新（添加管理后台路由）
- [x] `frontend/src/api/apiClient.js` - 已更新（添加管理后台API）

### Docker配置
- [x] `backend/Dockerfile`
- [x] `frontend/Dockerfile`
- [x] `frontend/nginx.conf`
- [x] `docker-compose.yml`

### 文档
- [x] `README.md` - 项目主文档
- [x] `docs/architecture.md` - 架构文档
- [x] `DEPLOYMENT_CHECKLIST.md` - 本文件
- [x] `backend/requirements.txt` - 已更新（添加新依赖）

## 🚀 下一步操作（按顺序执行）

### 1. 环境准备

```bash
# 后端
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 2. 配置环境变量

#### 方法一：使用密钥生成工具（推荐）

```bash
cd backend
python generate_keys.py
```

工具会自动生成两个密钥，复制输出到 `.env` 文件中。

#### 方法二：手动生成密钥

**生成SECRET_KEY（JWT密钥）：**
```bash
# Python方式
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 或者使用OpenSSL
openssl rand -base64 32
```

**生成ENCRYPTION_KEY（Fernet加密密钥）：**
```bash
# Python方式
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

#### 创建.env文件

```bash
# 在backend目录创建.env文件
cd backend
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# 然后编辑.env文件，替换以下内容：
# SECRET_KEY=你生成的密钥
# ENCRYPTION_KEY=你生成的密钥
```

**示例.env文件内容：**
```env
# 数据库配置
DATABASE_URL=sqlite:///./zhixueban.db

# JWT配置（必须修改）
SECRET_KEY=你的32位随机密钥
ENCRYPTION_KEY=你的Fernet密钥

# AI模型配置（默认AI提供商）
# 可选值：deepseek, moonshot, wenxin, xinghuo, chatglm
# 如果不设置，默认使用 deepseek
AI_PROVIDER=deepseek

# DeepSeek API配置（如果使用DeepSeek）
DEEPSEEK_API_KEY=你的deepseek-api-key
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# 其他配置可以保持默认值...
```

### 3. 启动后端服务

```bash
cd backend
uvicorn main:app --reload --port 8000
```

**检查点：**
- [ ] 后端服务成功启动在 http://localhost:8000
- [ ] 访问 http://localhost:8000/docs 可以看到API文档
- [ ] 数据库表自动创建成功（查看控制台输出）

### 4. 启动前端服务

```bash
cd frontend
npm run dev
```

**检查点：**
- [ ] 前端服务成功启动在 http://localhost:5173
- [ ] 可以访问登录页面

### 5. 创建管理员账号

1. 访问 http://localhost:5173/register
2. 注册第一个用户（将自动成为管理员）
3. 登录后访问 http://localhost:5173/admin/dashboard

**检查点：**
- [ ] 可以成功注册用户
- [ ] 可以成功登录
- [ ] 可以访问管理后台（第一个用户自动有管理员权限）

### 6. 配置AI模型

1. 登录管理后台
2. 进入"模型管理"
3. 添加模型配置：
   - 提供商名称：deepseek（或其他）
   - API密钥：填写实际的API密钥
   - Base URL：可选，留空使用默认
   - 优先级：设置数字（越大优先级越高）
   - 启用：勾选

**检查点：**
- [ ] 可以成功添加模型配置
- [ ] 可以测试模型调用
- [ ] 测试返回成功结果

### 7. 配置Prompt

1. 进入"Prompt管理"
2. 创建系统Prompt：
   - 名称：system_prompt
   - 内容：填写系统提示词
   - 描述：系统默认提示词
   - 启用：勾选

**检查点：**
- [ ] 可以成功创建Prompt
- [ ] 可以查看版本列表
- [ ] 可以启用/禁用版本

### 8. 运行测试

```bash
cd backend
pytest -v
```

**检查点：**
- [ ] 所有测试通过

### 9. Docker部署（可选）

```bash
# 构建并启动
docker-compose up --build

# 查看日志
docker-compose logs -f
```

**检查点：**
- [ ] 容器成功启动
- [ ] 可以访问 http://localhost:80（前端）
- [ ] 可以访问 http://localhost:8000（后端）

## ⚠️ 注意事项

1. **安全性**：
   - 生产环境必须修改所有默认密钥
   - 使用强随机密钥生成器生成SECRET_KEY和ENCRYPTION_KEY
   - 限制CORS允许的域名

2. **数据库**：
   - 开发环境使用SQLite（默认）
   - 生产环境建议使用MySQL或PostgreSQL
   - 修改DATABASE_URL配置

3. **API密钥**：
   - 所有API密钥在数据库中加密存储
   - 不要在代码中硬编码密钥
   - 通过管理后台配置密钥

4. **日志**：
   - 日志文件保存在 `backend/logs/` 目录
   - 生产环境建议配置日志轮转
   - 定期清理旧日志文件

5. **性能优化**：
   - Prompt缓存TTL为5分钟
   - 生产环境建议使用Redis缓存
   - 配置数据库连接池

## 🔍 故障排查

### 后端启动失败
- 检查Python版本（需要3.9+）
- 检查依赖是否全部安装
- 查看错误日志

### 前端启动失败
- 检查Node.js版本（需要18+）
- 清除node_modules重新安装
- 检查端口是否被占用

### 管理后台无法访问
- 确认已使用管理员账号登录
- 检查JWT token是否有效
- 查看浏览器控制台错误

### 模型调用失败
- 检查API密钥是否正确
- 检查网络连接
- 查看后端日志

## 📞 获取帮助

如遇到问题，请：
1. 查看README.md文档
2. 查看docs/architecture.md架构文档
3. 检查日志文件
4. 提交Issue

---

**最后更新：** 2024年
**版本：** v2.0

