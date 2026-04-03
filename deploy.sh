#!/bin/bash
# ============================================
# 智学伴 AI 个性化学习平台 - Ubuntu 22.04 一键部署脚本
# 使用方法: sudo bash deploy.sh
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
APP_DIR="/opt/zhixueban"
REPO_URL="https://github.com/YEYUbaka/AI-learning-companion.git"
BRANCH="main"
DOMAIN="your-domain.com"  # 修改为你的域名或 IP

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 sudo 运行此脚本: sudo bash deploy.sh"
    exit 1
fi

log_info "=========================================="
log_info "  智学伴 AI 学习平台 - Ubuntu 22.04 部署"
log_info "=========================================="

# ============================================
# 1. 系统更新和依赖安装
# ============================================
log_info "[1/10] 更新系统包..."
apt update -y
apt upgrade -y

log_info "[2/10] 安装系统依赖..."
apt install -y \
    python3.10 python3.10-venv python3.10-dev \
    nodejs npm \
    mysql-server \
    nginx \
    git \
    curl \
    wget \
    build-essential \
    pkg-config \
    libmysqlclient-dev

# ============================================
# 3. 配置 MySQL
# ============================================
log_info "[3/10] 配置 MySQL 数据库..."

# 启动 MySQL
systemctl enable mysql
systemctl start mysql

# 生成随机密码
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# 创建数据库和用户
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS zhixueban CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'zhixueban'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON zhixueban.* TO 'zhixueban'@'localhost';
FLUSH PRIVILEGES;
EOF

log_info "数据库密码: ${DB_PASSWORD} (请妥善保管)"

# ============================================
# 3. 安装 Node.js LTS (v20)
# ============================================
log_info "[3/10] 安装 Node.js LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# ============================================
# 4. 克隆项目代码
# ============================================
log_info "[4/10] 克隆项目代码..."

if [ -d "$APP_DIR" ]; then
    log_warn "目录 $APP_DIR 已存在，将更新代码..."
    cd "$APP_DIR"
    git pull origin $BRANCH
else
    mkdir -p "$APP_DIR"
    git clone --depth 1 -b $BRANCH $REPO_URL "$APP_DIR"
fi

cd "$APP_DIR"

# ============================================
# 5. 配置后端
# ============================================
log_info "[5/10] 配置后端环境..."

cd "$APP_DIR/backend"

# 创建虚拟环境
python3.10 -m venv venv
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt

# 生成 .env 文件
cat > .env <<EOF
# 数据库配置
DATABASE_URL=mysql+pymysql://zhixueban:${DB_PASSWORD}@localhost:3306/zhixueban?charset=utf8mb4

# 安全配置
SECRET_KEY=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# AI 模型配置
DEFAULT_AI_PROVIDER=deepseek
AI_TIMEOUT=120

# DeepSeek / 硅基流动
DEEPSEEK_API_KEY=请在此填写你的DeepSeek_API_Key

# 文心一言
WENXIN_API_KEY=请在此填写你的文心一言_API_Key
WENXIN_API_BASE_URL=https://qianfan.baidubce.com/v2
WENXIN_MODEL=ernie-x1.1

# 星火
XINGHUO_API_KEY=请在此填写你的星火_API_Key
XINGHUO_API_BASE_URL=https://spark-api-open.xf-yun.com/v2/
XINGHUO_MODEL=general

# ChatGLM
CHATGLM_API_KEY=请在此填写你的ChatGLM_API_Key
CHATGLM_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
CHATGLM_MODEL=glm-4.6

# Moonshot
MOONSHOT_API_KEY=请在此填写你的Moonshot_API_Key
MOONSHOT_API_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=kimi-k2-0905-preview

# 种子数据
AUTO_SYNC_SEED_DATA=true
PROMPT_SEED_PATH=seed_data/prompts.json
MODEL_CONFIG_SEED_PATH=seed_data/models.json

# 日志
LOG_LEVEL=INFO
EOF

log_warn "请编辑 $APP_DIR/backend/.env 填入你的 AI API Key!"

# ============================================
# 6. 构建前端
# ============================================
log_info "[6/10] 构建前端..."

cd "$APP_DIR/frontend"

# 安装依赖
npm install

# 创建 .env.production
cat > .env.production <<EOF
VITE_API_BASE=http://127.0.0.1:8000
EOF

# 构建
npm run build

# ============================================
# 7. 配置 Nginx
# ============================================
log_info "[7/10] 配置 Nginx..."

cat > /etc/nginx/sites-available/zhixueban <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # 前端静态文件
    location / {
        root ${APP_DIR}/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }

    # 后端文档
    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # 文件上传大小限制
    client_max_body_size 50M;
}
EOF

ln -sf /etc/nginx/sites-available/zhixueban /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试并重启 Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# ============================================
# 8. 创建 systemd 服务
# ============================================
log_info "[8/10] 创建系统服务..."

cat > /etc/systemd/system/zhixueban-backend.service <<EOF
[Unit]
Description=智学伴 AI 学习平台 - 后端服务
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/backend
ExecStart=${APP_DIR}/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=PATH=${APP_DIR}/backend/venv/bin

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable zhixueban-backend
systemctl start zhixueban-backend

# ============================================
# 9. 设置权限
# ============================================
log_info "[9/10] 设置文件权限..."

chown -R root:root "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod 600 "$APP_DIR/backend/.env"

# 创建上传目录
mkdir -p "$APP_DIR/backend/uploads"
chmod 755 "$APP_DIR/backend/uploads"

# ============================================
# 10. 验证部署
# ============================================
log_info "[10/10] 验证部署..."

sleep 5

# 检查后端
if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    log_info "后端服务运行正常"
else
    log_warn "后端服务可能未完全启动，请检查: systemctl status zhixueban-backend"
fi

# 检查前端
if curl -s http://127.0.0.1/ > /dev/null 2>&1; then
    log_info "前端服务运行正常"
else
    log_warn "前端服务可能未完全启动，请检查: systemctl status nginx"
fi

# ============================================
# 部署完成
# ============================================
echo ""
log_info "=========================================="
log_info "  部署完成!"
log_info "=========================================="
echo ""
log_info "访问地址:"
log_info "  前端: http://$(curl -s ifconfig.me)"
log_info "  后端 API: http://$(curl -s ifconfig.me)/api/"
log_info "  API 文档: http://$(curl -s ifconfig.me)/docs"
echo ""
log_warn "重要: 请编辑 $APP_DIR/backend/.env 填入你的 AI API Key"
log_warn "数据库密码: ${DB_PASSWORD}"
echo ""
log_info "常用命令:"
log_info "  查看后端日志: journalctl -u zhixueban-backend -f"
log_info "  重启后端: systemctl restart zhixueban-backend"
log_info "  重启前端: systemctl restart nginx"
log_info "  更新代码: cd $APP_DIR && git pull && systemctl restart zhixueban-backend"
echo ""
