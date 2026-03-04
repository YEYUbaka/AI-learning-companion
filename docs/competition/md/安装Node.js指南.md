# 📦 Node.js 安装指南

## ⚠️ 当前问题

你的系统未安装 Node.js 或 npm 未加入环境变量。

## 🔧 解决方案

### 方案一：安装 Node.js（推荐）

#### 1. 下载安装包
访问：https://nodejs.org/zh-cn/
下载 LTS 版本（推荐 18.x 或 20.x）

#### 2. 安装步骤
- 运行安装程序
- **重要**：勾选 "Add to PATH" 选项
- 完成安装后重启 PowerShell

#### 3. 验证安装
```powershell
node --version
npm --version
```

应该显示版本号。

#### 4. 安装前端依赖
```bash
cd frontend
npm install
```

#### 5. 启动项目
```bash
npm run dev
```

---

### 方案二：使用其他包管理器

#### 使用 Chocolatey（如果已安装）
```powershell
choco install nodejs
```

#### 使用 Winget（Windows 10/11）
```powershell
winget install OpenJS.NodeJS
```

---

### 方案三：手动设置环境变量

如果已安装 Node.js 但 npm 命令无效：

1. 查找 Node.js 安装路径（通常在）：
   - `C:\Program Files\nodejs`
   - `C:\Program Files (x86)\nodejs`

2. 添加到环境变量：
   - 右键"此电脑" → 属性 → 高级系统设置
   - 环境变量 → 系统变量 → Path → 编辑
   - 添加 Node.js 路径

---

## 🚀 快速测试

安装完成后，测试命令：

```powershell
# 检查版本
node --version
npm --version

# 进入项目并安装
cd F:\Cursor\ projects\Web\frontend
npm install

# 启动开发服务器
npm run dev
```

---

## 📝 替代方案：使用 Yarn

如果已安装 Yarn：

```bash
cd frontend
yarn install
yarn dev
```

---

## 🎯 下一步

安装 Node.js 后，按以下步骤操作：

1. **重启终端**（关闭并重新打开 PowerShell）
2. **验证安装**：`npm --version`
3. **进入项目**：`cd frontend`
4. **安装依赖**：`npm install`
5. **启动服务**：`npm run dev`

## 🔗 相关链接

- Node.js 官网：https://nodejs.org/
- 中文镜像：https://npmmirror.com/
- 前端项目：`frontend/README.md`

