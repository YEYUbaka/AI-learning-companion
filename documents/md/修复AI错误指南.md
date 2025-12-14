# 🔧 修复 AI 接口错误指南

## ⚠️ 当前错误

```
❌ 错误：调用 AI 接口失败：__init__() got an unexpected keyword argument 'proxies'
```

## 🔍 问题原因

这是 OpenAI SDK 版本兼容性问题。某些参数在新版本中已经被移除或修改。

## ✅ 解决方案

### 方法一：重新安装依赖（推荐）

在**后端终端窗口**中运行：

1. **停止后端服务**（按 Ctrl+C）

2. **重新安装 OpenAI**
   ```powershell
   cd "F:\Cursor projects\Web\backend"
   venv\Scripts\activate
   pip install --upgrade openai
   ```

3. **重新启动后端**
   ```powershell
   .\启动.bat
   ```

### 方法二：使用固定版本的 OpenAI

或者使用兼容性更好的版本：

```powershell
cd "F:\Cursor projects\Web\backend"
venv\Scripts\activate
pip install openai==1.30.0
```

然后重新启动后端。

### 方法三：更新所有依赖

```powershell
cd "F:\Cursor projects\Web\backend"
venv\Scripts\activate
pip install --upgrade -r requirements.txt
```

## 🔄 完整重启流程

1. **停止后端**（按 Ctrl+C）
2. **安装/更新依赖**
   ```powershell
   pip install --upgrade openai
   ```
3. **重启后端**
   ```powershell
   python main.py
   ```
   或
   ```powershell
   uvicorn main:app --reload --port 8000
   ```

## 📝 已完成的修复

我已经：
- ✅ 修改了 `backend/utils/openai_client.py` 添加了更好的错误处理
- ✅ 更新了 `backend/requirements.txt` 使用更灵活的版本号
- ✅ 添加了调试日志

## 🧪 测试

重启后端后：
1. 访问前端：http://localhost:5173/ai
2. 输入问题："你好"
3. 查看是否能正常回答

## 🔗 参考

如果需要查看详细错误信息，查看后端终端的日志输出。

