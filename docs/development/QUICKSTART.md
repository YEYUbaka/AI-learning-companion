# 🚀 快速开始指南

## 一键安装和启动（推荐）

### 方法一：使用批处理脚本（Windows）

1. **安装环境和依赖**
   ```bash
   install.bat
   ```

2. **启动服务**
   ```bash
   start.bat
   ```

### 方法二：手动安装

1. **创建虚拟环境**
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```

2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **配置环境变量**
   - 在 `backend` 目录下找到 `.env` 文件
   - 修改 AI_API_KEY 为你的真实密钥：
     ```env
     AI_API_KEY=你的API密钥
     AI_API_BASE_URL=https://api.deepseek.com
     AI_MODEL=deepseek-chat
     ```
   - 支持硅基流动、OpenAI 等多种 API 提供商
   - 详细配置请查看 `环境配置说明.md`

4. **启动服务**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## 📝 数据库准备

确保 SQL Server 已启动，数据库配置如下：
- 数据库名：`ZhixueBan`
- 用户名：`sa`
- 密码：`123456`

如果数据库不存在，请手动创建：
```sql
CREATE DATABASE ZhixueBan;
```

## ✅ 验证安装

1. 访问：http://127.0.0.1:8000
2. 查看文档：http://127.0.0.1:8000/docs
3. 测试注册接口
4. 测试 AI 问答接口

## 🎯 测试 API

### 1. 用户注册测试

使用浏览器访问 http://127.0.0.1:8000/docs，在界面中测试：

**接口**: POST `/api/v1/auth/register`

**请求体**:
```json
{
  "email": "test@example.com",
  "name": "测试用户",
  "password": "123456"
}
```

### 2. AI 问答测试

**接口**: POST `/api/v1/ai/ask`

**请求体**:
```json
{
  "prompt": "帮我写一份三天的Python学习计划"
}
```

## 🐛 问题排查

1. **端口被占用**：修改 `start.bat` 或命令中的端口号
2. **数据库连接失败**：检查 SQL Server 服务状态
3. **API Key 错误**：确保 `.env` 文件中的密钥正确
4. **模块导入错误**：确保虚拟环境已激活

## 📞 获取帮助

- 查看 `README.md` 获取详细文档
- 检查日志输出寻找错误信息
