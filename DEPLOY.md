# 智学伴 - Ubuntu 22.04 部署指南

## 快速部署（推荐）

### 1. 准备服务器

需要一台 Ubuntu 22.04 服务器，建议配置：
- CPU: 2 核以上
- 内存: 4GB 以上
- 磁盘: 20GB 以上
- 开放端口: 80（HTTP）、443（HTTPS，可选）

### 2. 执行一键部署

```bash
# 克隆项目
git clone https://github.com/YEYUbaka/AI-learning-companion.git
cd AI-learning-companion

# 执行部署脚本（需要 sudo 权限）
sudo bash deploy.sh
```

### 3. 配置 AI API Key

部署完成后，编辑后端配置文件：

```bash
sudo nano /opt/zhixueban/backend/.env
```

找到以下行，填入你的真实 API Key：

```
DEEPSEEK_API_KEY=sk-你的真实Key
WENXIN_API_KEY=你的真实Key
XINGHUO_API_KEY=你的真实Key
CHATGLM_API_KEY=你的真实Key
MOONSHOT_API_KEY=你的真实Key
```

保存后重启后端：

```bash
sudo systemctl restart zhixueban-backend
```

### 4. 访问系统

- **前端页面**: `http://你的服务器IP`
- **API 文档**: `http://你的服务器IP/docs`
- **管理后台**: `http://你的服务器IP/admin`

---

## 手动部署（可选）

如果你想逐步手动部署：

### 安装依赖

```bash
sudo apt update
sudo apt install -y python3.10 python3.10-venv nodejs npm mysql-server nginx git
```

### 配置 MySQL

```bash
sudo mysql -u root -e "CREATE DATABASE zhixueban CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -u root -e "CREATE USER 'zhixueban'@'localhost' IDENTIFIED BY '你的密码';"
sudo mysql -u root -e "GRANT ALL PRIVILEGES ON zhixueban.* TO 'zhixueban'@'localhost';"
```

### 部署后端

```bash
cd /opt/zhixueban/backend
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# 编辑 .env 文件后启动
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
```

### 构建前端

```bash
cd /opt/zhixueban/frontend
npm install
npm run build
```

### 配置 Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/zhixueban
sudo ln -s /etc/nginx/sites-available/zhixueban /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## 常用运维命令

| 操作 | 命令 |
|------|------|
| 查看后端状态 | `sudo systemctl status zhixueban-backend` |
| 查看后端日志 | `sudo journalctl -u zhixueban-backend -f` |
| 重启后端 | `sudo systemctl restart zhixueban-backend` |
| 重启 Nginx | `sudo systemctl restart nginx` |
| 更新代码 | `cd /opt/zhixueban && git pull && sudo systemctl restart zhixueban-backend` |
| 查看数据库 | `sudo mysql -u zhixueban -p zhixueban` |

---

## HTTPS 配置（可选）

使用 Let's Encrypt 免费证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

---

## 故障排查

### 后端启动失败

```bash
# 查看日志
sudo journalctl -u zhixueban-backend -n 50

# 常见原因：
# 1. .env 文件未配置 API Key
# 2. MySQL 未启动: sudo systemctl start mysql
# 3. 端口被占用: sudo lsof -i :8000
```

### 前端 502 错误

```bash
# 检查 Nginx 配置
sudo nginx -t

# 检查后端是否在运行
curl http://127.0.0.1:8000/health
```

### 数据库连接失败

```bash
# 检查 MySQL 状态
sudo systemctl status mysql

# 测试连接
mysql -u zhixueban -p -e "SELECT 1;"
```
