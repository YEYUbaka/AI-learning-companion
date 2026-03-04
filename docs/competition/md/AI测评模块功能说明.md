# 📝 AI自动测评与错题讲解模块

## ✅ 功能已完成

已成功创建AI自动测评与错题讲解模块，包含完整的前后端代码。

---

## 📁 文件结构

### 后端文件

```
backend/
├── models/
│   └── quizzes.py              # 测评数据模型
├── routers/
│   └── quiz.py                 # 测评接口路由
├── utils/
│   └── quiz_generator.py       # AI出题与批改逻辑
├── main.py                     # 已更新，引入新路由
└── models/__init__.py          # 已更新
```

### 前端文件

```
frontend/src/
├── pages/
│   ├── Quiz.jsx                # 题目生成与答题页
│   └── QuizResult.jsx          # 结果展示页
├── api/
│   └── apiClient.js            # 已更新，添加新API
└── App.jsx                     # 已更新，添加新路由
```

---

## 🎯 功能特点

### 1. AI自动出题

- ✅ 根据主题自动生成5道题目
- ✅ 包含3道选择题 + 2道填空题
- ✅ 选择题有4个选项（A、B、C、D）
- ✅ 题目针对性强，难度适中

### 2. 在线答题

- ✅ 美观的答题界面
- ✅ 选择题单选交互
- ✅ 填空题文本输入
- ✅ 实时保存答案
- ✅ 提交前验证完整性

### 3. AI自动批改

- ✅ 自动判断对错
- ✅ 计算得分（满分100分）
- ✅ 每题20分
- ✅ 显示正确率统计

### 4. 错题讲解

- ✅ 每题都有详细讲解
- ✅ 显示标准答案和用户答案
- ✅ 使用Markdown格式渲染
- ✅ 正确/错误状态清晰标识

### 5. 数据存储

- ✅ SQLite数据库存储
- ✅ 记录题目、答案、得分、讲解
- ✅ 支持查询历史记录
- ✅ 支持查看详细记录

---

## 📋 API接口说明

### 生成测验题目

**POST** `/api/v1/quiz/generate`

请求体：
```json
{
  "topic": "Python基础语法",
  "num_questions": 5,
  "provider": "deepseek"
}
```

返回：
```json
{
  "success": true,
  "topic": "Python基础语法",
  "questions": [
    {
      "question": "Python中用于定义函数的关键字是什么？",
      "options": ["A. function", "B. def", "C. define", "D. func"],
      "answer": "B",
      "type": "choice"
    },
    {
      "question": "Python中用于输出内容到控制台的函数是____。",
      "answer": "print",
      "type": "fill"
    }
  ],
  "message": "测验题目生成成功"
}
```

### 提交测验答案

**POST** `/api/v1/quiz/submit`

请求体：
```json
{
  "user_id": 1,
  "topic": "Python基础语法",
  "questions": [...],
  "answers": ["B", "print", "A", "list", "import"]
}
```

返回：
```json
{
  "success": true,
  "score": 80,
  "explanations": [
    {
      "question": "题目内容",
      "correct": true,
      "explanation": "讲解内容..."
    }
  ],
  "quiz_id": 1,
  "message": "测验提交成功"
}
```

### 获取测评历史

**GET** `/api/v1/quiz/history/{user_id}`

返回：
```json
{
  "success": true,
  "quizzes": [
    {
      "id": 1,
      "user_id": 1,
      "topic": "Python基础语法",
      "score": 80,
      "created_at": "2024-01-01T00:00:00"
    }
  ],
  "count": 1
}
```

### 获取测评详情

**GET** `/api/v1/quiz/{quiz_id}`

返回完整的测评记录，包括题目、答案、讲解等。

---

## 🎨 前端页面

### Quiz.jsx - 答题页面

**功能**:
- 输入测验主题
- 生成AI题目
- 在线答题
- 提交答案

**UI特点**:
- 现代化设计
- 清晰的题目展示
- 友好的交互体验
- 实时错误提示

### QuizResult.jsx - 结果页面

**功能**:
- 显示得分和评价
- 展示每题讲解
- 显示正确/错误状态
- 支持再次测评

**UI特点**:
- 得分可视化展示
- 颜色区分正确/错误
- Markdown格式讲解
- 统计信息展示

---

## 🧪 测试步骤

### 1. 启动服务

**后端**:
```powershell
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**前端**:
```powershell
cd frontend
npm run dev
```

### 2. 访问页面

访问: http://localhost:5173/quiz

### 3. 测试流程

1. **输入主题**: 例如 "Python基础语法"
2. **生成题目**: 点击"生成测验"按钮
3. **答题**: 完成所有题目
4. **提交**: 点击"提交测验"按钮
5. **查看结果**: 自动跳转到结果页面

### 4. 查看历史

访问: http://localhost:5173/quiz
- 可以查看历史测评记录（如果前端支持）

---

## 🔧 技术实现

### AI模型使用

- 使用项目配置的AI模型（DeepSeek等）
- 通过 `.env` 文件配置
- 支持切换不同模型

### 数据库设计

**quizzes 表结构**:
- `id`: 主键
- `user_id`: 用户ID
- `topic`: 测验主题
- `questions`: 题目列表（JSON）
- `answers`: 用户答案（JSON）
- `score`: 得分（0-100）
- `explanations`: 讲解内容（JSON）
- `created_at`: 创建时间

### JSON格式

**题目格式**:
```json
{
  "question": "题目文本",
  "type": "choice" | "fill",
  "options": ["A. xxx", "B. xxx", ...],  // 仅选择题
  "answer": "B"  // 标准答案
}
```

**讲解格式**:
```json
{
  "question": "题目文本",
  "correct": true | false,
  "explanation": "详细讲解内容（支持Markdown）"
}
```

---

## 🎯 使用场景

1. **学习检测**: 学完一个主题后，生成测验检测掌握程度
2. **错题分析**: 查看错题讲解，理解知识点
3. **学习追踪**: 查看历史测评记录，了解学习进度
4. **个性化学习**: 根据测评结果调整学习计划

---

## ⚠️ 注意事项

1. **AI模型配置**: 确保 `.env` 文件中配置了AI API密钥
2. **数据库**: 首次运行会自动创建表结构
3. **题目数量**: 默认生成5道题，可在请求中指定
4. **答案验证**: 提交前会检查是否所有题目都已作答

---

## 🚀 后续优化建议

1. **题目类型扩展**:
   - 多选题
   - 判断题
   - 简答题

2. **功能增强**:
   - 错题本功能
   - 学习报告生成
   - 知识点分析

3. **性能优化**:
   - 题目缓存
   - 批量生成
   - 异步处理

4. **用户体验**:
   - 答题倒计时
   - 进度条显示
   - 题目收藏

---

**功能已全部完成，可以立即使用！** 🎉

