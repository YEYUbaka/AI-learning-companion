# 🔧 修复 Pydantic Core 导入错误

## ❌ 错误信息

```
ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'
```

## 🔍 问题原因

1. **Python 版本太新**：Python 3.14 可能与某些包的二进制扩展不兼容
2. **二进制扩展未正确安装**：`pydantic_core` 是 C 扩展，需要预编译的 wheel 文件
3. **虚拟环境问题**：包安装不完整或损坏

## ✅ 解决方案

### 方案一：使用自动修复脚本（推荐）

1. 将 `修复pydantic错误.bat` 复制到 `C:\Web\Zhixueban\backend` 目录
2. 双击运行脚本
3. 等待修复完成
4. 重新启动服务

### 方案二：手动修复

在 PowerShell 中执行：

```powershell
cd C:\Web\Zhixueban\backend
.\venv\Scripts\activate.ps1

# 1. 卸载旧的包
pip uninstall pydantic pydantic-core pydantic-settings -y

# 2. 升级构建工具
python -m pip install --upgrade pip setuptools wheel

# 3. 重新安装 pydantic-core（二进制扩展）
pip install pydantic-core --only-binary :all: --no-cache-dir

# 4. 安装 pydantic
pip install pydantic==2.9.2 --no-cache-dir

# 5. 安装其他相关包
pip install "pydantic[email]==2.9.2" pydantic-settings==2.5.2 --no-cache-dir

# 6. 验证
python -c "import pydantic; import pydantic_core; print('成功！')"
```

### 方案三：重新安装所有依赖

如果方案二不行，尝试：

```powershell
cd C:\Web\Zhixueban\backend
.\venv\Scripts\activate.ps1

# 强制重新安装所有依赖
pip install -r requirements.txt --force-reinstall --no-cache-dir
```

### 方案四：使用 Python 3.12（如果方案一、二、三都不行）

Python 3.14 可能太新，建议使用 Python 3.12：

```powershell
# 1. 删除旧虚拟环境
Remove-Item -Recurse -Force venv

# 2. 使用 Python 3.12 创建新虚拟环境
py -3.12 -m venv venv

# 3. 激活并安装依赖
.\venv\Scripts\activate.ps1
pip install -r requirements.txt
```

## 🔍 诊断步骤

### 1. 检查 Python 版本

```powershell
python --version
```

**建议版本**：Python 3.10, 3.11, 或 3.12（不要用 3.14）

### 2. 检查 pydantic 安装

```powershell
pip list | findstr pydantic
```

应该看到：
- pydantic
- pydantic-core
- pydantic-settings

### 3. 测试导入

```powershell
python -c "import pydantic_core; print(pydantic_core.__version__)"
```

如果失败，说明二进制扩展有问题。

### 4. 检查虚拟环境

```powershell
# 确保使用的是虚拟环境中的 Python
where python
# 应该显示: C:\Web\Zhixueban\backend\venv\Scripts\python.exe
```

## 🚀 修复后启动

```powershell
cd C:\Web\Zhixueban\backend
.\venv\Scripts\activate.ps1
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## 📋 常见问题

### Q1: 仍然报错 "No module named 'pydantic_core._pydantic_core'"

**解决**：
1. 检查 Python 版本（不要用 3.14）
2. 尝试使用国内镜像：
   ```powershell
   pip install pydantic-core -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```

### Q2: 安装时提示 "Failed building wheel"

**解决**：
```powershell
# 使用预编译版本
pip install pydantic-core --only-binary :all:
```

### Q3: 虚拟环境中的 Python 版本不对

**解决**：
```powershell
# 删除旧虚拟环境
Remove-Item -Recurse -Force venv

# 使用指定 Python 版本创建
py -3.12 -m venv venv
```

## ✅ 验证修复成功

运行以下命令，应该都能成功：

```powershell
python -c "import fastapi; print('FastAPI OK')"
python -c "import pydantic; print('Pydantic OK')"
python -c "import pydantic_core; print('Pydantic Core OK')"
python -c "from main import app; print('App import OK')"
```

如果全部成功，就可以启动服务了！

