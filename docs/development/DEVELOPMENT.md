# 智学伴 AI个性化学习平台 - 开发文档

本文档提供前后端开发的详细指南，帮助开发者快速上手项目。

## 📋 目录

- [环境要求](#环境要求)
- [后端开发](#后端开发)
- [前端开发](#前端开发)
- [项目结构](#项目结构)
- [API 接口](#api-接口)
- [数据库设计](#数据库设计)
- [常见问题](#常见问题)

---

## 环境要求

### 后端
- **Python**: 3.10 或更高版本
- **pip**: 最新版本
- **数据库**: SQLite（开发环境）或 SQL Server / MySQL（生产环境）

### 前端
- **Node.js**: 18.0 或更高版本
- **npm**: 9.0 或更高版本

---

## 后端开发

### 1. 项目结构

```
backend/
├── main.py                 # FastAPI 应用入口
├── database.py             # 数据库连接配置
├── requirements.txt        # Python 依赖
├── core/                   # 核心模块
│   ├── config.py          # 配置管理
│   ├── security.py         # 安全相关（JWT、加密）
│   └── logger.py           # 日志管理
├── models/                 # 数据模型（SQLAlchemy ORM）
├── routers/                # API 路由
├── services/               # 业务逻辑层
├── repositories/           # 数据访问层
├── schemas/                # Pydantic 模型（请求/响应）
├── utils/                  # 工具函数
├── seed_data/              # 种子数据（JSON）
└── tests/                  # 单元测试
```

### 2. 快速开始

#### 2.1 创建虚拟环境

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

#### 2.2 安装依赖

```bash
pip install -r requirements.txt
```

#### 2.3 配置环境变量

创建 `backend/.env` 文件（参考 `backend/.env.template`）：

```env
# 数据库配置
DATABASE_URL=sqlite:///./zhixueban.db

# JWT 配置（生产环境必须修改）
SECRET_KEY=your-secret-key-change-in-production
ENCRYPTION_KEY=default-encryption-key-change-in-production

# AI 配置
DEFAULT_AI_PROVIDER=deepseek
AI_TIMEOUT=120
```

**生成密钥：**

```bash
# 生成 SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 生成 ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

或使用项目提供的工具：

```bash
python generate_keys.py
```

#### 2.4 启动服务

```bash
# 开发模式（热重载）
uvicorn main:app --reload --port 8000

# 生产模式
uvicorn main:app --host 0.0.0.0 --port 8000
```

服务启动后：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

### 3. 代码规范

#### 3.1 架构分层

项目采用分层架构，严格遵循以下规则：

```
router (路由层)
  ↓
service (业务逻辑层)
  ↓
repository (数据访问层)
  ↓
model (数据模型层)
```

**禁止在 router 中写业务逻辑！**

#### 3.2 示例代码

**Router（只处理请求/响应）：**

```python
from fastapi import APIRouter, Depends
from schemas.quiz import QuizGenerateRequest, QuizResponse
from services.quiz_service import QuizService

router = APIRouter(prefix="/api/v1/quiz", tags=["quiz"])

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    request: QuizGenerateRequest,
    service: QuizService = Depends()
):
    return await service.generate_quiz(request)
```

**Service（业务逻辑）：**

```python
class QuizService:
    def __init__(self, db: Session = Depends(get_db)):
        self.repo = QuizRepository(db)
    
    async def generate_quiz(self, request: QuizGenerateRequest):
        # 业务逻辑处理
        quiz = await self.repo.create(...)
        return quiz
```

**Repository（数据访问）：**

```python
class QuizRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, quiz_data: dict):
        quiz = Quiz(**quiz_data)
        self.db.add(quiz)
        self.db.commit()
        return quiz
```

### 4. 数据库操作

#### 4.1 创建模型

```python
from models.base import Base
from sqlalchemy import Column, Integer, String

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    name = Column(String(100))
```

#### 4.2 数据库迁移

首次运行会自动创建表：

```python
# main.py 启动时
Base.metadata.create_all(bind=engine)
```

### 5. API 开发

#### 5.1 添加新路由

1. 在 `routers/` 创建新文件或添加到现有文件
2. 在 `main.py` 中注册路由：

```python
from routers import quiz, auth

app.include_router(auth.router)
app.include_router(quiz.router)
```

#### 5.2 请求/响应模型

使用 Pydantic 定义：

```python
from pydantic import BaseModel

class QuizRequest(BaseModel):
    subject: str
    difficulty: str
    num_questions: int

class QuizResponse(BaseModel):
    id: int
    questions: list
```

### 6. 测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_quiz.py

# 查看覆盖率
pytest --cov=backend tests/
```

---

## 前端开发

### 1. 项目结构

```
frontend/
├── src/
│   ├── main.jsx           # 入口文件
│   ├── App.jsx             # 主应用组件
│   ├── pages/              # 页面组件
│   ├── components/         # 通用组件
│   ├── api/                # API 客户端
│   ├── store/              # 状态管理（Zustand）
│   └── utils/              # 工具函数
├── package.json            # 依赖配置
├── vite.config.js          # Vite 配置
└── tailwind.config.js      # TailwindCSS 配置
```

### 2. 快速开始

#### 2.1 安装依赖

```bash
cd frontend
npm install
```

#### 2.2 启动开发服务器

```bash
npm run dev
```

访问：http://localhost:5173

#### 2.3 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 3. 代码规范

#### 3.1 组件结构

```jsx
import { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

export const MyComponent = () => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // 数据获取
  }, []);
  
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

#### 3.2 API 调用

所有 API 调用统一通过 `src/api/apiClient.js`：

```javascript
import { generateQuiz } from '../api/apiClient';

const handleGenerate = async () => {
  try {
    const response = await generateQuiz({
      subject: '数学',
      difficulty: '中等',
      num_questions: 10
    });
    // 处理响应
  } catch (error) {
    // 处理错误
  }
};
```

#### 3.3 状态管理

使用 Zustand：

```javascript
// store/themeStore.js
import { create } from 'zustand';

export const useThemeStore = create((set) => ({
  isDark: false,
  toggleTheme: () => set((state) => ({ isDark: !state.isDark }))
}));

// 组件中使用
import { useThemeStore } from '../store/themeStore';

const { isDark, toggleTheme } = useThemeStore();
```

### 4. 路由配置

在 `src/App.jsx` 中配置：

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
  </Route>
</Routes>
```

### 5. 样式规范

使用 TailwindCSS：

```jsx
<div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
    标题
  </h1>
</div>
```

---

## API 接口

### 认证相关

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/auth/me` - 获取当前用户信息

### 学习计划

- `POST /api/v1/ai/plan/generate` - 生成学习计划
- `GET /api/v1/ai/plan/list/{user_id}` - 获取学习计划列表
- `GET /api/v1/ai/plan/{plan_id}` - 获取学习计划详情

### 智能组卷

- `POST /api/v1/quiz/paper/generate` - 生成试卷
- `GET /api/v1/quiz/paper/list/{user_id}` - 获取试卷列表
- `GET /api/v1/quiz/paper/{paper_id}` - 获取试卷详情
- `GET /api/v1/quiz/paper/{paper_id}/export` - 导出试卷

### AI 问答

- `POST /api/v1/ai/ask` - AI 问答
- `POST /api/v1/chat/send` - 发送聊天消息

### 管理后台

- `GET /api/v1/admin/dashboard` - 仪表盘数据
- `GET /api/v1/admin/models` - 模型列表
- `POST /api/v1/admin/models` - 创建模型配置
- `GET /api/v1/admin/prompts` - Prompt 列表
- `POST /api/v1/admin/prompts` - 创建 Prompt

详细 API 文档请访问：http://localhost:8000/docs

---

## 数据库设计

### 主要表结构

- **users** - 用户表
- **study_plans** - 学习计划表
- **quizzes** - 测验表
- **quiz_papers** - 试卷表
- **paper_templates** - 试卷模板表
- **learning_maps** - 知识图谱表
- **chat_sessions** - 聊天会话表
- **model_configs** - AI 模型配置表
- **prompts** - Prompt 模板表
- **api_call_logs** - API 调用日志表

详细设计请查看 `backend/models/` 目录下的模型文件。

---

## 常见问题

### 后端

**Q: 启动时提示数据库连接失败？**

A: 检查 `DATABASE_URL` 配置，确保数据库文件路径正确或数据库服务已启动。

**Q: 导入模块失败？**

A: 确保虚拟环境已激活，且所有依赖已安装。

**Q: JWT 认证失败？**

A: 检查 `SECRET_KEY` 配置，确保与生成 token 时使用的密钥一致。

### 前端

**Q: API 请求失败？**

A: 检查后端服务是否启动，以及 `apiClient.js` 中的 `baseURL` 配置。

**Q: 样式不生效？**

A: 确保 TailwindCSS 配置正确，检查 `tailwind.config.js`。

**Q: 路由跳转失败？**

A: 检查路由配置和 `ProtectedRoute` 组件的权限判断。

---

## 开发工具

### 推荐 VS Code 插件

- Python
- Pylance
- ESLint
- Prettier
- Tailwind CSS IntelliSense

### 调试

**后端调试：**

在 VS Code 中创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/backend/main.py",
      "console": "integratedTerminal"
    }
  ]
}
```

**前端调试：**

使用浏览器开发者工具，或安装 React DevTools 扩展。

---

## 贡献指南

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

---

## 许可证

MIT License

---

**如有问题，请提交 Issue 或联系开发团队。**

