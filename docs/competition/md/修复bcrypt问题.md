# 🔧 修复 bcrypt 错误

## ⚠️ 问题原因

错误信息：`AttributeError: module 'bcrypt' has no attribute '__about__'`

这是 bcrypt 版本不兼容问题。

## ✅ 解决方案

### 在后端终端执行：

```powershell
# 先停止后端（Ctrl+C）

# 重新安装 bcrypt
cd "F:\Cursor projects\Web\backend"
venv\Scripts\activate
pip uninstall bcrypt -y
pip install bcrypt==4.0.1

# 重新启动
.\启动.bat
```

### 或者更新所有依赖：

```powershell
cd "F:\Cursor projects\Web\backend"
venv\Scripts\activate
pip install --upgrade passlib[bcrypt]
pip install bcrypt==4.0.1
```

## 🧪 测试

重新启动后，再次尝试注册，应该就能成功了！









