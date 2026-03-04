# 修复 pydantic-core 模块错误

## 问题描述

错误信息：`ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'`

这通常是因为：
1. Python 3.14 太新，pydantic-core 2.23.4 没有预编译包
2. 需要从源码编译，但可能缺少编译工具

## 解决方案

### 方案一：使用更新版本的 pydantic（推荐）

```bash
cd backend
.\venv\Scripts\activate

# 卸载旧版本
pip uninstall pydantic pydantic-core -y

# 安装最新版本（有Python 3.14的预编译包）
pip install "pydantic>=2.10.0" "pydantic-core>=2.25.0"
```

### 方案二：使用 Python 3.11 或 3.12（如果方案一不行）

如果方案一仍然有问题，建议使用 Python 3.11 或 3.12：

```bash
# 创建新的虚拟环境（使用Python 3.11或3.12）
python3.11 -m venv venv311
# 或
python3.12 -m venv venv312

# 激活虚拟环境
.\venv311\Scripts\activate  # Windows
# source venv311/bin/activate  # Linux/Mac

# 安装依赖
pip install -r requirements.txt
```

### 方案三：安装编译工具（如果必须从源码编译）

Windows 需要安装 Visual Studio Build Tools：

1. 下载并安装：https://visualstudio.microsoft.com/downloads/
2. 选择 "Desktop development with C++" 工作负载
3. 重新运行 `pip install pydantic-core`

## 快速修复命令

```bash
cd backend
.\venv\Scripts\activate
pip install --upgrade "pydantic>=2.10.0" "pydantic-core>=2.25.0" --no-cache-dir
```

## 验证安装

```bash
python -c "import pydantic; import pydantic_core; print('✅ pydantic安装成功')"
```

如果看到 "✅ pydantic安装成功"，说明问题已解决。

