# 智学伴 AI个性化学习平台

> 全国大学生计算机设计大赛参赛作品

一个基于 AI 大模型的智能个性化学习平台，支持学习计划生成、智能组卷、知识图谱构建、AI 问答等功能。

## ✨ 核心功能

- 📚 **智能学习计划生成** - 基于上传教材和用户目标，AI 自动生成个性化学习计划
- 📝 **智能组卷系统** - 支持自定义难度、题型分布，AI 自动生成试卷
- 🧠 **知识图谱可视化** - 自动提取知识点并构建知识图谱，支持交互式探索
- 💬 **AI 智能问答** - 多模型支持，支持上下文记忆和教师人格切换
- 📊 **学习数据分析** - 测验成绩统计、错题分析、学习进度跟踪
- 📄 **报告导出** - 支持 PDF/Word 格式的学习报告导出

## 🛠️ 技术栈

### 后端
- **FastAPI** - 现代、快速的 Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **SQLite** - 轻量级数据库（支持 SQL Server）
- **Pydantic** - 数据验证和设置管理
- **JWT** - 用户认证和授权
- **ReportLab** - PDF 报告生成
- **PyMuPDF / python-docx / python-pptx** - 文档解析

### 前端
- **React 18** - UI 框架
- **Vite** - 构建工具
- **React Router** - 路由管理
- **TailwindCSS** - 样式框架
- **Zustand** - 状态管理
- **Recharts** - 数据可视化
- **react-force-graph** - 知识图谱可视化
- **react-markdown** - Markdown 渲染

### AI 集成
- 支持多模型提供商（DeepSeek、OpenAI、硅基流动等）
- 统一的 AI 服务接口
- 模型配置管理和自动切换
- Prompt 模板管理

## 🚀 快速开始

### 环境要求

- **Python**: 3.10+
- **Node.js**: 18+
- **数据库**: SQLite（默认）或 SQL Server 2012+

### 1. 克隆项目

```bash
git clone <repository-url>
cd Web
```

### 2. 后端配置

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 复制环境变量模板
cp ../.env.example .env

# 编辑 .env 文件，填入你的配置（特别是 SECRET_KEY 和 AI API 密钥）
```

### 3. 前端配置

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 4. 启动后端服务

```bash
# 在 backend 目录下
uvicorn main:app --reload --port 8000
```

### 5. 访问应用

- **前端**: http://localhost:5173
- **后端 API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/health

## 📁 项目结构

```
Web/
├── backend/                 # 后端服务
│   ├── main.py             # FastAPI 应用入口
│   ├── database.py         # 数据库配置
│   ├── core/               # 核心模块
│   │   ├── config.py       # 配置管理
│   │   ├── security.py     # 安全相关（JWT、加密）
│   │   └── logger.py       # 日志管理
│   ├── models/             # 数据模型
│   ├── routers/            # API 路由
│   ├── services/           # 业务逻辑层
│   ├── repositories/       # 数据访问层
│   ├── schemas/            # Pydantic 模型
│   ├── utils/              # 工具函数
│   ├── seed_data/          # 种子数据
│   ├── tests/              # 单元测试
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 通用组件
│   │   ├── api/            # API 客户端
│   │   ├── store/          # 状态管理
│   │   └── utils/          # 工具函数
│   ├── package.json        # Node.js 依赖
│   └── vite.config.js      # Vite 配置
├── .env.example            # 环境变量模板
├── .gitignore             # Git 忽略文件
└── README.md              # 项目说明
```

## 🔧 配置说明

### 环境变量

详细配置请参考 `.env.example` 文件。主要配置项：

- `DATABASE_URL`: 数据库连接字符串
- `SECRET_KEY`: JWT 密钥（生产环境必须修改）
- `ENCRYPTION_KEY`: API 密钥加密密钥
- `DEFAULT_AI_PROVIDER`: 默认 AI 提供商
- `AUTO_SYNC_SEED_DATA`: 是否自动同步种子数据

### AI 模型配置

1. 在管理后台（`/admin`）配置 AI 模型
2. 添加 API 密钥（会自动加密存储）
3. 设置模型优先级和超时时间
4. 系统会自动选择可用的模型

### Prompt 管理

1. 在管理后台管理 Prompt 模板
2. 支持版本控制和启用/禁用
3. 支持从 JSON 文件自动同步

## 📖 使用指南

### 用户功能

1. **注册/登录** - 创建账户并登录系统
2. **上传教材** - 上传 PDF/DOCX/PPTX 格式的学习材料
3. **生成学习计划** - 基于教材和目标生成个性化学习计划
4. **智能组卷** - 配置试卷参数，AI 自动生成试卷
5. **知识图谱** - 查看知识点关系图谱
6. **AI 问答** - 与 AI 助手对话，获取学习帮助

### 管理员功能

1. **模型管理** - 配置和管理 AI 模型
2. **Prompt 管理** - 编辑和管理 Prompt 模板
3. **API 日志** - 查看 API 调用记录和统计
4. **用户管理** - 管理用户账户

## 🧪 测试

```bash
# 后端测试
cd backend
pytest

# 前端测试（如配置了测试框架）
cd frontend
npm test
```

## 📦 部署

### Docker 部署

```bash
# 使用 docker-compose
docker-compose up -d
```

### 生产环境注意事项

1. **修改默认密钥** - 必须修改 `.env` 中的 `SECRET_KEY` 和 `ENCRYPTION_KEY`
2. **配置 CORS** - 修改 `CORS_ORIGINS` 为实际域名
3. **数据库迁移** - 使用 Alembic 进行数据库版本管理
4. **HTTPS** - 配置反向代理（Nginx）启用 HTTPS
5. **日志管理** - 配置日志轮转和监控

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👥 团队

全国大学生计算机设计大赛参赛团队

## 🙏 致谢

感谢所有为项目做出贡献的开发者和用户！

---

**注意**: 本项目为参赛作品，仅供学习和参考使用。生产环境部署请务必修改所有默认密钥和配置。

