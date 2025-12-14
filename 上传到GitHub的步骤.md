# 上传到 GitHub 的完整步骤

## 📋 步骤概览

1. ✅ 在 GitHub 上创建新仓库
2. ✅ 本地提交代码
3. ✅ 连接到远程仓库
4. ✅ 推送到 GitHub

---

## 步骤 1: 在 GitHub 上创建仓库

### 1.1 填写仓库信息

在 GitHub 创建仓库页面填写：

- **Owner**: YEYUbaka（已选择）
- **Repository name**: `zhixueban-ai-learning-platform`
  - ⚠️ **重要**: 不要使用中文名称，GitHub 不支持
  - 建议名称：`zhixueban-ai-learning-platform` 或 `smart-learning-companion`
- **Description**（可选）:
  ```
  AI-powered personalized learning platform with intelligent quiz generation, knowledge graph, and study plan creation
  ```
- **Visibility**: 选择 `Public` 或 `Private`

### 1.2 配置选项

**⚠️ 重要：不要勾选以下选项！**

- ❌ **不要勾选** "Add a README file"（我们已经有 README.md）
- ❌ **不要勾选** "Add .gitignore"（我们已经有 .gitignore）
- ❌ **不要勾选** "Choose a license"（我们已经有 LICENSE）

**原因**: 如果勾选这些选项，GitHub 会创建一个初始提交，导致后续推送时出现冲突。

### 1.3 点击 "Create repository"

创建完成后，GitHub 会显示一个页面，显示如何推送现有仓库的说明。

---

## 步骤 2: 本地提交代码

在本地项目目录执行以下命令：

### 2.1 检查文件状态

```bash
git status
```

### 2.2 添加所有文件

```bash
git add .
```

### 2.3 再次检查（确认没有敏感文件）

```bash
git status
```

**确认以下文件没有被添加**：
- ❌ `.env`（环境变量文件）
- ❌ `*.db`（数据库文件）
- ❌ `venv/` 或 `.venv/`（虚拟环境）
- ❌ `node_modules/`（Node.js 依赖）
- ❌ `logs/`（日志文件）
- ❌ `uploads/`（上传文件）

### 2.4 提交代码

```bash
git commit -m "Initial commit: 智学伴 AI个性化学习平台"
```

---

## 步骤 3: 连接到远程仓库

### 3.1 添加远程仓库地址

将 `<your-github-username>` 替换为你的 GitHub 用户名（YEYUbaka），将 `<repository-name>` 替换为你创建的仓库名：

```bash
git remote add origin https://github.com/YEYUbaka/zhixueban-ai-learning-platform.git
```

### 3.2 验证远程仓库

```bash
git remote -v
```

应该显示：
```
origin  https://github.com/YEYUbaka/zhixueban-ai-learning-platform.git (fetch)
origin  https://github.com/YEYUbaka/zhixueban-ai-learning-platform.git (push)
```

---

## 步骤 4: 推送到 GitHub

### 4.1 设置主分支名称

```bash
git branch -M main
```

### 4.2 推送到 GitHub

```bash
git push -u origin main
```

**注意**: 
- 如果是第一次推送，GitHub 可能会要求你输入用户名和密码
- 如果启用了双因素认证，需要使用 Personal Access Token 作为密码
- 或者使用 SSH 密钥（更安全）

### 4.3 验证上传

推送成功后，刷新 GitHub 仓库页面，应该能看到所有文件。

---

## 🔐 认证问题解决

### 如果遇到认证错误

#### 方法 1: 使用 Personal Access Token

1. 访问：https://github.com/settings/tokens
2. 点击 "Generate new token" -> "Generate new token (classic)"
3. 设置权限：勾选 `repo` 权限
4. 生成后复制 token
5. 推送时，密码输入框输入这个 token

#### 方法 2: 使用 SSH（推荐）

1. 生成 SSH 密钥：
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. 复制公钥：
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

3. 在 GitHub 添加 SSH 密钥：
   - Settings -> SSH and GPG keys -> New SSH key
   - 粘贴公钥内容

4. 修改远程地址为 SSH：
   ```bash
   git remote set-url origin git@github.com:YEYUbaka/zhixueban-ai-learning-platform.git
   ```

---

## ✅ 完成检查清单

上传完成后，检查以下内容：

- [ ] GitHub 仓库页面能正常访问
- [ ] README.md 正确显示
- [ ] 所有源代码文件都在仓库中
- [ ] `.gitignore` 正确排除了敏感文件
- [ ] LICENSE 文件存在
- [ ] 没有 `.env`、`*.db` 等敏感文件

---

## 🎉 完成！

如果一切顺利，你的项目现在已经成功上传到 GitHub 了！

可以在 GitHub 仓库页面查看代码，分享链接，或者继续开发。

