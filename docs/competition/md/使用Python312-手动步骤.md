# 🔧 使用 Python 3.12 重新创建虚拟环境

## 📋 步骤说明

### 第一步：检查 Python 版本

在 PowerShell 中运行：

```powershell
# 查看所有已安装的 Python 版本
py --list

# 检查 Python 3.12
py -3.12 --version

# 查看 Python 3.12 的完整路径
py -3.12 -c "import sys; print(sys.executable)"
```

### 第二步：删除旧虚拟环境

```powershell
cd C:\Web\Zhixueban\backend

# 备份旧虚拟环境（可选）
if (Test-Path venv) {
    Move-Item venv venv_backup
}

# 或直接删除
Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue
```

### 第三步：使用 Python 3.12 创建新虚拟环境

```powershell
# 使用 py launcher 指定 Python 3.12
py -3.12 -m venv venv
```

**如果 `py -3.12` 不工作，尝试：**

```powershell
# 方法1：使用完整路径（需要先找到 Python 3.12 的安装路径）
# 通常在：C:\Users\你的用户名\AppData\Local\Programs\Python\Python312\python.exe
# 或：C:\Program Files\Python312\python.exe

# 方法2：使用 python3.12（如果 PATH 中有）
python3.12 -m venv venv

# 方法3：直接指定完整路径
& "C:\Program Files\Python312\python.exe" -m venv venv
```

### 第四步：激活虚拟环境

```powershell
.\venv\Scripts\activate.ps1
```

如果提示执行策略错误：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 第五步：验证 Python 版本

```powershell
python --version
```

应该显示：`Python 3.12.x`

### 第六步：安装依赖

```powershell
# 升级 pip
python -m pip install --upgrade pip

# 安装项目依赖
pip install -r requirements.txt
```

### 第七步：验证安装

```powershell
# 测试关键模块
python -c "import fastapi; print('FastAPI OK')"
python -c "import pydantic; print('Pydantic OK')"
python -c "import pydantic_core; print('Pydantic Core OK')"
```

### 第八步：启动服务

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 🚀 快速方式：使用脚本

### 方法一：检查 Python 版本

双击运行：`检查Python版本.bat`

这会显示所有已安装的 Python 版本。

### 方法二：自动重新创建虚拟环境

双击运行：`使用Python312重新创建虚拟环境.bat`

脚本会自动：
1. 检查 Python 3.12 是否可用
2. 备份旧虚拟环境
3. 使用 Python 3.12 创建新虚拟环境
4. 安装所有依赖
5. 验证安装

---

## 🔍 如果找不到 Python 3.12

### 检查安装位置

```powershell
# 检查常见安装位置
Get-ChildItem "C:\Program Files\Python*" -ErrorAction SilentlyContinue
Get-ChildItem "C:\Users\$env:USERNAME\AppData\Local\Programs\Python*" -ErrorAction SilentlyContinue
Get-ChildItem "C:\Python*" -ErrorAction SilentlyContinue
```

### 如果确实安装了但找不到

1. **检查环境变量 PATH**
   ```powershell
   $env:PATH -split ';' | Where-Object { $_ -like "*python*" }
   ```

2. **重新安装 Python 3.12**
   - 下载：https://www.python.org/downloads/
   - 安装时勾选 "Add Python to PATH"
   - 勾选 "Install for all users"（可选）

3. **使用完整路径创建虚拟环境**
   ```powershell
   # 找到 Python 3.12 的完整路径后
   & "C:\Program Files\Python312\python.exe" -m venv venv
   ```

---

## ✅ 验证成功

运行以下命令，应该都能成功：

```powershell
python --version                    # 应该显示 3.12.x
python -c "import fastapi"          # 无错误
python -c "import pydantic"          # 无错误
python -c "import pydantic_core"   # 无错误
python -c "from main import app"    # 无错误
```

如果全部成功，就可以启动服务了！

---

## 📝 常见问题

### Q: `py -3.12` 命令找不到

**解决**：使用完整路径或重新安装 Python 3.12

### Q: 创建虚拟环境后还是 Python 3.14

**解决**：确保使用 `py -3.12 -m venv venv` 而不是 `python -m venv venv`

### Q: 激活虚拟环境后版本不对

**解决**：删除虚拟环境，重新用 Python 3.12 创建

