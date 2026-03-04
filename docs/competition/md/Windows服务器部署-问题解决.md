# 🐛 Windows 服务器部署 - 问题解决

## ❌ 错误：多进程模式在 Windows 上失败

### 错误现象

```
Process SpawnProcess-2:
Process SpawnProcess-1:
Traceback (most recent call last):
  ...
  File "C:\Web\Zhixueban\backend\venv\Lib\site-packages\pydantic_core\__init__.py", line 6, in <module>
    from ._pydantic_core import (
```

### 问题原因

1. **Windows 多进程限制**：Windows 上的 `multiprocessing` 使用 `spawn` 方式，子进程需要重新导入所有模块
2. **二进制扩展问题**：`pydantic_core` 等 C 扩展在 Windows 多进程模式下可能无法正确加载
3. **路径问题**：子进程可能无法正确找到虚拟环境中的模块

### ✅ 解决方案

#### 方案一：使用单进程模式（推荐）

**修改启动命令，移除 `--workers` 参数：**

```powershell
# ❌ 错误的方式（Windows 上会失败）
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2

# ✅ 正确的方式（单进程）
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**为什么单进程就够了？**
- FastAPI 是异步框架，单进程就能处理大量并发请求
- Windows 上单进程更稳定，避免多进程导入问题
- 对于临时部署，单进程完全够用

#### 方案二：使用 reload 模式（开发环境）

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**注意**：`--reload` 和 `--workers` 不能同时使用

#### 方案三：如果需要多进程（生产环境）

如果确实需要多进程，建议：

1. **使用 NSSM 管理多个实例**
   ```powershell
   # 安装 NSSM
   # 创建多个服务实例，每个使用不同端口
   nssm install ZhixuebanBackend1 "C:\Web\Zhixueban\backend\venv\Scripts\python.exe" "-m uvicorn main:app --host 0.0.0.0 --port 8000"
   nssm install ZhixuebanBackend2 "C:\Web\Zhixueban\backend\venv\Scripts\python.exe" "-m uvicorn main:app --host 0.0.0.0 --port 8001"
   ```

2. **使用 IIS + ARR（应用程序请求路由）做负载均衡**

3. **使用 Linux 服务器**（多进程在 Linux 上更稳定）

---

## 📋 正确的启动步骤

### 1. 激活虚拟环境

```powershell
cd C:\Web\Zhixueban\backend
.\venv\Scripts\activate.ps1
```

### 2. 启动服务（单进程模式）

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. 验证服务

```powershell
# 测试健康检查
Invoke-WebRequest -Uri http://127.0.0.1:8000/health

# 或浏览器访问
# http://你的服务器IP:8000/docs
```

---

## 🚀 性能说明

### 单进程性能

- **FastAPI 是异步框架**，单进程可以处理数千并发连接
- **对于临时部署**，单进程完全够用
- **Windows 上更稳定**，避免多进程导入问题

### 何时需要多进程？

- 需要处理**数万并发**时
- 有**CPU 密集型任务**时
- **生产环境**且流量很大时

**对于临时部署，单进程完全足够！**

---

## 🔧 已修复的文件

- ✅ `启动后端服务.bat` - 已移除 `--workers 2` 参数
- ✅ 现在使用单进程模式启动

---

## 📝 其他注意事项

### 如果遇到其他导入错误

1. **重新安装依赖**
   ```powershell
   pip uninstall pydantic pydantic-core -y
   pip install pydantic pydantic-core
   ```

2. **检查 Python 版本**
   ```powershell
   python --version
   ```
   建议使用 Python 3.10-3.12（不要用 3.14，可能太新）

3. **使用虚拟环境中的 Python**
   ```powershell
   .\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

---

## ✅ 总结

**问题**：Windows 上使用 `--workers` 多进程模式导致导入错误

**解决**：使用单进程模式启动（`--workers` 参数已移除）

**性能**：单进程对于临时部署完全够用，FastAPI 异步处理能力强

