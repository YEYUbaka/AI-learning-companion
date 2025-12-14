# GitHub 上传完整指南

## 📋 第一步：在 GitHub 网页上创建仓库

### 1.1 填写仓库信息

在 GitHub 创建仓库页面，按以下设置：

- ✅ **Repository name**: `智学伴AI个性化学习平台` （你已经填写好了）
- ✅ **Description**: 可以填写：`基于 AI 大模型的智能个性化学习平台 - 全国大学生计算机设计大赛参赛作品`
- ✅ **Visibility**: 选择 `Public`（公开）或 `Private`（私有）

### 1.2 ⚠️ 重要：不要勾选以下选项

**因为我们已经创建了这些文件，所以不要勾选：**

- ❌ **Add README** - 保持 `Off`（我们已经有了 `README.md`）
- ❌ **Add .gitignore** - 保持 `No .gitignore`（我们已经有了 `.gitignore`）
- ❌ **Add license** - 保持 `No license`（我们已经有了 `LICENSE`）

### 1.3 点击创建

点击绿色的 **"Create repository"** 按钮创建仓库。

---

## 📋 第二步：在本地初始化 Git 仓库

创建完 GitHub 仓库后，GitHub 会显示一个页面，上面有仓库的 URL，类似：
```
https://github.com/YEYUbaka/智学伴AI个性化学习平台.git
```

**先不要关闭这个页面**，我们需要这个 URL。

现在在本地项目目录执行以下命令：

### 2.1 初始化 Git 仓库

```bash
git init
```

### 2.2 检查 .gitignore 是否生效

```bash
git status
```

你应该看到很多文件，但**不应该**看到：
- `venv/` 或 `.venv/`
- `node_modules/`
- `*.db` 文件
- `logs/` 目录
- `uploads/` 目录
- `.env` 文件

如果看到这些文件，说明 `.gitignore` 没有生效，需要检查。

### 2.3 添加所有文件

```bash
git add .
```

### 2.4 再次检查（重要！）

```bash
git status
```

**确认没有以下敏感文件：**
- ❌ `.env` 文件
- ❌ `*.db` 数据库文件
- ❌ `backend/zhixueban.db`
- ❌ 日志文件
- ❌ 上传的用户文件

### 2.5 提交文件

```bash
git commit -m "Initial commit: 智学伴 AI个性化学习平台"
```

---

## 📋 第三步：连接到 GitHub 并推送

### 3.1 添加远程仓库

将 GitHub 仓库的 URL 替换到下面的命令中：

```bash
git remote add origin https://github.com/YEYUbaka/智学伴AI个性化学习平台.git
```

**注意**：如果仓库名称包含中文，URL 可能会被编码，你可以：
1. 直接从 GitHub 页面复制 URL
2. 或者使用 SSH 方式：`git@github.com:YEYUbaka/智学伴AI个性化学习平台.git`

### 3.2 设置主分支名称

```bash
git branch -M main
```

### 3.3 推送到 GitHub

```bash
git push -u origin main
```

**如果这是第一次推送，可能会要求你：**
1. 输入 GitHub 用户名
2. 输入 GitHub 密码（或 Personal Access Token）

**如果遇到认证问题：**
- 使用 Personal Access Token 代替密码
- 或者配置 SSH 密钥

---

## 📋 第四步：验证上传成功

1. 刷新 GitHub 仓库页面
2. 你应该能看到所有文件
3. 确认 `README.md` 正确显示
4. 确认 `.gitignore` 文件存在
5. 确认 `LICENSE` 文件存在

---

## ⚠️ 常见问题处理

### 问题 1：推送时提示 "remote origin already exists"

**解决方法：**
```bash
git remote remove origin
git remote add origin <your-repo-url>
```

### 问题 2：推送时提示认证失败

**解决方法：**
1. 使用 Personal Access Token：
   - 去 GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 生成新 token，勾选 `repo` 权限
   - 使用 token 作为密码

2. 或配置 SSH：
   ```bash
   # 生成 SSH 密钥
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # 将公钥添加到 GitHub Settings → SSH and GPG keys
   ```

### 问题 3：推送时提示 "large files" 错误

**解决方法：**
如果 `Web4.zip` 文件太大（超过 100MB），需要：
1. 从 `.gitignore` 中确认 `*.zip` 已被排除
2. 如果已经添加，需要从 Git 历史中移除：
   ```bash
   git rm --cached Web4.zip
   git commit -m "Remove large zip file"
   ```

### 问题 4：中文文件名显示乱码

**解决方法：**
```bash
git config --global core.quotepath false
```

---

## 🎯 快速命令总结

```bash
# 1. 初始化
git init

# 2. 检查状态
git status

# 3. 添加文件
git add .

# 4. 提交
git commit -m "Initial commit: 智学伴 AI个性化学习平台"

# 5. 添加远程仓库（替换为你的 URL）
git remote add origin https://github.com/YEYUbaka/智学伴AI个性化学习平台.git

# 6. 设置主分支
git branch -M main

# 7. 推送
git push -u origin main
```

---

## ✅ 完成后的检查清单

- [ ] GitHub 仓库已创建
- [ ] 本地 Git 仓库已初始化
- [ ] 所有文件已提交（没有敏感文件）
- [ ] 代码已成功推送到 GitHub
- [ ] README.md 在 GitHub 上正确显示
- [ ] .gitignore 文件存在且生效
- [ ] LICENSE 文件存在

---

**祝上传顺利！** 🚀

