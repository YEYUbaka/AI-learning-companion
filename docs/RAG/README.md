---
title: "知识库使用说明"
grade_level: "小学"
subject: "数学"
topic: ""
difficulty: "easy"
source: ""
tags: []
---

# 智学伴知识库使用说明

## 目录结构

```
knowledge_base/
├── _index/          <- ChromaDB 向量索引（程序自动生成，勿手动修改）
├── images/          <- 全局图片池（程序自动复制）
└── corpus/          <- ★ 在这里整理知识文档
    ├── 小学/
    │   ├── 数学/
    │   ├── 语文/
    │   └── 英语/
    ├── 初中/
    │   ├── 数学/ 物理/ 化学/ 生物/
    │   └── 语文/ 英语/ 历史/ 地理/ 政治/
    ├── 高中/
    │   └── （同初中学科 + 信息技术）
    ├── 大学/
    │   ├── 高等数学/ 大学物理/ 计算机科学/ ...
    ├── 通用常识/
    └── 试卷真题/
        ├── 高考/ 中考/ 期末卷/
```

## 知识文件格式

每个文件为 Markdown 格式，顶部包含 YAML frontmatter 元数据：

```markdown
---
title: "分数的加减运算"
grade_level: "小学"        # 小学/初中/高中/大学/通用
subject: "数学"
topic: "分数运算"
tags: ["分数", "通分", "加减法"]
difficulty: "easy"         # easy/medium/hard
source: "人教版五年级上册"  # 来源（可选）
---

# 分数的加减运算

## 同分母分数相加减

同分母分数相加减，分母不变，分子相加减。

例：1/4 + 2/4 = 3/4

## 异分母分数相加减

先通分，再按同分母分数加减计算。

**例题**：1/2 + 1/3 = ?
解：通分为 3/6 + 2/6 = 5/6
```

## 图片使用

- 在文档同目录下创建 `{文件名}_images/` 文件夹
- 图片用相对路径引用：`![描述](./xxx_images/abc.png)`
- 程序索引时自动将图片复制到 `knowledge_base/images/`

## 导入方式

### 方式 1：批量导入（推荐）
将 `.md` 文件放入对应目录，然后调用 API：
```
POST /api/v1/knowledge/scan
Authorization: Bearer {admin_token}
```

### 方式 2：管理后台
登录系统 → 管理后台 → 知识库管理 → 上传/扫描

### 方式 3：单文件注册
```
POST /api/v1/knowledge/documents
{
  "file_path": "E:/AI_projects/Web/knowledge_base/corpus/小学/数学/分数运算.md"
}
```

## 安装 RAG 依赖

```bash
# 1. 安装 PyTorch CPU 版（约 300MB）
pip install torch --index-url https://download.pytorch.org/whl/cpu

# 2. 安装 ChromaDB 和 SentenceTransformers
pip install chromadb>=0.5.0 sentence-transformers>=3.0.0 pyyaml>=6.0.0
```

首次运行时会自动下载嵌入模型（约 400MB），之后可离线使用。
