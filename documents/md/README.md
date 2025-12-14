# 智学伴 AI个性化学习平台 v2.0

## 📖 项目简介

智学伴是一个由全国大学生计算机设计大赛参赛团队开发的AI学习助手平台，提供个性化学习计划生成、AI自动测评、学习进度可视化等功能。

### 核心特性

- 🤖 **多模型支持**：支持DeepSeek、通义千问、ChatGLM、讯飞星火等多种AI模型
- 📝 **Prompt管理**：可视化管理和版本控制AI提示词模板
- 🎯 **个性化学习**：根据上传的学习材料自动生成学习计划
- 📊 **智能测评**：AI自动出题、批改和错题讲解
- 📈 **学习分析**：可视化学习进度和成长报告
- 🔐 **管理后台**：完整的后台管理系统，支持模型配置、Prompt管理等
- 🧮 **Markdown + LaTeX 渲染**：AI对话支持公式与Markdown混排，显示课程/高数公式更清晰

## 🏗️ 技术栈

### 后端
- FastAPI 0.115.0
- SQLAlchemy 2.0.35
- SQLite / MySQL
- JWT认证
- Pydantic数据验证

### 前端
- React 18.2.0
- Vite 5.0.8
- Tailwind CSS 3.3.6
- React Router 6.30.1
- Axios 1.13.2

## 🚀 快速开始

### 环境要求

- Python 3.9+
- Node.js 18+
- SQLite（开发环境）或 MySQL（生产环境）

### 本地开发

#### 1. 后端启动

```bash
cd backend

# 创建虚拟环境（Windows）
python -m venv venv
venv\Scripts\activate

# 创建虚拟环境（Linux/Mac）
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 创建.env文件（参考.env.example）
# 复制.env.example为.env并修改配置

# 启动服务
uvicorn main:app --reload --port 8000
```

后端服务将在 `http://localhost:8000` 启动

#### 2. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

### Docker部署

```bash
# 构建并启动所有服务
docker-compose up --build

# 后台运行
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 📁 项目结构

```
.
├── backend/                 # 后端代码
│   ├── core/               # 核心模块（配置、安全、日志）
│   ├── models/             # 数据模型
│   ├── schemas/            # Pydantic DTO
│   ├── repositories/       # 数据访问层
│   ├── services/           # 业务逻辑层
│   ├── routers/            # 路由层
│   ├── utils/              # 工具函数
│   ├── tests/              # 单元测试
│   └── main.py             # 应用入口
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   │   └── Admin/      # 管理后台页面
│   │   ├── components/     # 通用组件
│   │   ├── api/            # API客户端
│   │   └── store/           # 状态管理
│   └── package.json
├── docker-compose.yml      # Docker编排配置
└── README.md               # 项目文档
```

## 🔐 管理员设置

### 首次运行

1. 启动后端服务
2. 第一个注册的用户将自动成为管理员
3. 使用管理员账号登录后访问 `/admin/dashboard`

### 管理后台功能

- **仪表盘** (`/admin/dashboard`)：查看系统统计信息
- **模型管理** (`/admin/models`)：配置AI模型（API密钥、URL、优先级等）
- **Prompt管理** (`/admin/prompts`)：管理和版本控制Prompt模板
- **系统配置** (`/admin/config`)：系统参数配置

## 🧪 测试

### 后端测试

```bash
cd backend
pytest -v

# 运行特定测试文件
pytest tests/test_prompt.py -v
pytest tests/test_admin.py -v
```

### 前端测试

```bash
cd frontend
npm test
```

## 📚 API文档

启动后端服务后，访问以下地址查看API文档：

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🔧 配置说明

### 环境变量

创建 `backend/.env` 文件，参考 `.env.example`：

```env
# 数据库
DATABASE_URL=sqlite:///./zhixueban.db

# JWT密钥（生产环境必须修改）
SECRET_KEY=your-secret-key-change-in-production

# 加密密钥（用于加密存储的API密钥）
ENCRYPTION_KEY=default-encryption-key-change-in-production

# AI模型配置（默认AI提供商）
# 可选值：deepseek, moonshot, wenxin, xinghuo, chatglm
# 如果不设置，默认使用 deepseek
AI_PROVIDER=deepseek

# DeepSeek API配置（如果使用DeepSeek）
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# 其他配置...
```

### 模型配置

1. 登录管理后台
2. 进入"模型管理"
3. 添加模型配置：
   - 提供商名称（如：deepseek, qwen, chatglm, xfy）
   - API密钥
   - Base URL（可选，使用默认值）
   - 优先级（数字越大优先级越高）
   - 启用状态

### Prompt配置

1. 进入"Prompt管理"
2. 创建Prompt模板：
   - 名称（如：system_prompt, quiz_generator）
   - 内容（Prompt文本）
   - 描述
   - 启用状态

3. 支持版本管理：
   - 每次创建新版本，版本号自动+1
   - 可以启用/禁用特定版本
   - 系统使用最新启用的版本

## 🐛 故障排除

### 后端启动失败

1. 检查Python版本：`python --version`（需要3.9+）
2. 检查依赖安装：`pip install -r requirements.txt`
3. 检查数据库连接：确认DATABASE_URL配置正确

### 前端启动失败

1. 检查Node.js版本：`node --version`（需要18+）
2. 清除缓存：`rm -rf node_modules package-lock.json && npm install`
3. 检查端口占用：确认5173端口未被占用

### 管理后台无法访问

1. 确认已使用管理员账号登录
2. 检查JWT token是否有效
3. 查看浏览器控制台错误信息

## 📝 开发规范

### 代码规范

- Python代码使用type hints
- 遵循PEP 8规范
- 前端使用ESLint + Prettier

### 提交规范

- 功能开发：`feat: 描述`
- 问题修复：`fix: 描述`
- 文档更新：`docs: 描述`

## 📄 许可证

MIT License

## 👥 贡献者

智学伴开发团队

## 📞 联系方式

如有问题，请提交Issue或联系开发团队。

---

**注意**：生产环境部署前，请务必修改所有默认密钥和配置！

