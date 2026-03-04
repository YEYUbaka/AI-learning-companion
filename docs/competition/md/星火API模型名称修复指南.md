# 🔧 星火API模型名称修复指南

## 🔍 问题分析

从日志可以看到：
```
[ERROR] API调用失败 - Provider: 星火, Error: Error code: 400 - {'error': {'message': 'invalid param model:spark-3.5'}}
```

**问题**：当前使用的模型名称 `spark-3.5` 不正确。

**Base URL**：`https://spark-api-open.xf-yun.com/v2/` （这是OpenAI兼容的代理服务）

## 🧪 测试正确的模型名称

### 方法1：使用测试脚本（推荐）

我已经创建了一个测试脚本，可以自动测试常见的模型名称：

```powershell
cd backend
.\venv\Scripts\activate
python test_xinghuo_models.py
```

这个脚本会尝试以下模型名称，找到可用的：
- `generalv3.5`
- `generalv3`
- `general`
- `x1`
- `4.0Ultra`
- `spark-3.5`
- `spark-4.0`
- `spark-lite`
- 等等...

### 方法2：手动尝试

在 `.env` 文件中修改 `XINGHUO_MODEL`，尝试以下值：

```ini
# 选项1
XINGHUO_MODEL=generalv3.5

# 选项2
XINGHUO_MODEL=generalv3

# 选项3
XINGHUO_MODEL=x1

# 选项4
XINGHUO_MODEL=4.0Ultra
```

每次修改后：
1. 重启后端服务
2. 在前端测试星火模型
3. 查看后端日志，看是否成功

## 📋 常见星火模型名称

根据星火API文档，常见的模型名称包括：

| 模型名称 | 说明 |
|---------|------|
| `generalv3.5` | 通用版本3.5 |
| `generalv3` | 通用版本3 |
| `x1` | X1版本 |
| `4.0Ultra` | 4.0 Ultra版本 |
| `general` | 通用版本（可能已废弃） |

## ⚠️ 重要提示

### 1. 星火API的特殊性

星火API有两种调用方式：
- **WebSocket方式**：官方推荐，但需要特殊SDK
- **OpenAI兼容方式**：通过代理服务（如 `spark-api-open.xf-yun.com`）

你当前使用的是OpenAI兼容方式，所以可以使用标准的OpenAI客户端。

### 2. 如何确认正确的模型名称

1. **查看API文档**：访问讯飞开放平台文档
2. **查看你的API密钥权限**：登录平台，查看你的密钥可以访问哪些模型
3. **使用测试脚本**：运行 `test_xinghuo_models.py` 自动测试

### 3. 如果所有模型名称都不行

可能的原因：
- API密钥没有访问权限
- Base URL不正确
- 需要使用WebSocket方式（需要特殊实现）

## 🎯 快速修复步骤

1. **运行测试脚本**：
   ```powershell
   cd backend
   .\venv\Scripts\activate
   python test_xinghuo_models.py
   ```

2. **查看输出**，找到成功的模型名称

3. **修改 `.env` 文件**：
   ```ini
   XINGHUO_MODEL=generalv3.5  # 使用测试脚本找到的正确名称
   ```

4. **重启后端服务**

5. **测试**：在前端切换星火模型并发送问题

## ✅ 预期结果

修复后，后端日志应该显示：
```
[DEBUG] API调用成功，开始流式返回
[DEBUG] 路由层 - 收到chunk: type=content, provider=星火
```

而不是：
```
[ERROR] API调用失败 - Provider: 星火, Error: ...
```

---

**运行测试脚本后，告诉我结果，我会帮你确定正确的模型名称！** 🚀

