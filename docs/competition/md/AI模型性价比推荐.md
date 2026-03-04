# 🤖 AI模型性价比推荐 - 学习计划生成

## 📊 当前配置

**当前使用的模型**: 从 `.env` 文件中的 `AI_PROVIDER` 读取，默认是 `deepseek`

**学习计划生成特点**:
- 需要生成结构化 JSON 数据
- 需要理解学习目标和教材内容
- 输出格式要求严格（JSON数组）

---

## 💰 性价比对比（学习计划生成场景）

### 1. DeepSeek（推荐 ⭐⭐⭐⭐⭐）

**价格**: 极低（约 ¥0.14/1M tokens）
**性能**: 优秀，JSON生成能力强
**速度**: 快
**推荐指数**: ⭐⭐⭐⭐⭐

**优点**:
- ✅ 价格最便宜
- ✅ JSON格式输出能力强
- ✅ 响应速度快
- ✅ 支持长文本处理

**适用场景**: 学习计划生成、代码生成、结构化数据生成

**配置**:
```ini
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

---

### 2. Moonshot (Kimi)（推荐 ⭐⭐⭐⭐）

**价格**: 低（约 ¥0.12/1M tokens）
**性能**: 优秀，中文理解好
**速度**: 快
**推荐指数**: ⭐⭐⭐⭐

**优点**:
- ✅ 价格便宜
- ✅ 中文理解能力强
- ✅ 长文本处理优秀（支持200K上下文）
- ✅ JSON生成能力好

**适用场景**: 中文学习计划、长文档理解

**配置**:
```ini
AI_PROVIDER=moonshot
MOONSHOT_API_KEY=你的密钥
MOONSHOT_API_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=kimi-k2-0905-preview
```

---

### 3. ChatGLM（推荐 ⭐⭐⭐）

**价格**: 中等（约 ¥0.10/1M tokens）
**性能**: 良好
**速度**: 中等
**推荐指数**: ⭐⭐⭐

**优点**:
- ✅ 价格适中
- ✅ 中文支持好
- ✅ 国产模型

**缺点**:
- ⚠️ JSON格式输出偶尔不稳定
- ⚠️ 速度相对较慢

**配置**:
```ini
AI_PROVIDER=chatglm
CHATGLM_API_KEY=你的密钥
CHATGLM_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4
CHATGLM_MODEL=glm-4.6
```

---

### 4. 文心一言（不推荐用于此场景）

**价格**: 较高
**性能**: 优秀
**推荐指数**: ⭐⭐

**缺点**:
- ❌ 价格较高
- ❌ 对于结构化JSON生成，性价比不如DeepSeek

---

### 5. 星火（不推荐用于此场景）

**价格**: 较高
**性能**: 优秀
**推荐指数**: ⭐⭐

**缺点**:
- ❌ 价格较高
- ❌ 配置相对复杂

---

## 🎯 推荐方案

### 方案1：DeepSeek（最推荐）✨

**理由**:
1. 价格最便宜（约 ¥0.14/1M tokens）
2. JSON生成能力强，适合结构化输出
3. 响应速度快
4. 你已经在使用（当前默认）

**适用**: 所有学习计划生成场景

### 方案2：Moonshot（备选）

**理由**:
1. 价格便宜（约 ¥0.12/1M tokens）
2. 中文理解能力强
3. 长文本处理优秀

**适用**: 需要处理长文档或中文理解要求高的场景

---

## 🔧 如何切换模型

### 方法1：修改默认模型（推荐）

编辑 `backend/.env` 文件：

```ini
# 使用 DeepSeek（推荐）
AI_PROVIDER=deepseek

# 或使用 Moonshot
AI_PROVIDER=moonshot
```

然后**重启后端服务**。

### 方法2：前端指定模型（临时）

在前端上传文件时，可以在请求中指定 `provider` 参数（如果前端支持）。

---

## 📈 成本估算

假设每天生成 100 个学习计划，每个计划约 2000 tokens：

| 模型 | 每1M tokens价格 | 每天成本 | 每月成本 |
|------|----------------|---------|---------|
| **DeepSeek** | ¥0.14 | ¥0.028 | ¥0.84 |
| **Moonshot** | ¥0.12 | ¥0.024 | ¥0.72 |
| **ChatGLM** | ¥0.10 | ¥0.020 | ¥0.60 |
| **文心一言** | ¥0.50+ | ¥0.10+ | ¥3.00+ |

**结论**: DeepSeek 和 Moonshot 都是性价比极高的选择！

---

## ✅ 最终建议

**对于学习计划生成，推荐使用 DeepSeek**，原因：

1. ✅ **价格最便宜** - 成本最低
2. ✅ **JSON生成能力强** - 适合结构化输出
3. ✅ **响应速度快** - 用户体验好
4. ✅ **你已经在使用** - 无需额外配置

**如果 DeepSeek 不可用，备选 Moonshot**。

---

## 🔍 如何检查当前配置

运行以下命令查看当前配置：

```powershell
cd backend
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(f'当前AI模型: {os.getenv(\"AI_PROVIDER\", \"deepseek\")}')"
```

---

**总结**: 当前默认使用 DeepSeek 已经是最优选择！如果希望更低成本，可以考虑 Moonshot，但差异不大。✨

