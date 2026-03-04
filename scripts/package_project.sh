#!/bin/bash
# 项目打包脚本 (Bash)
# 用于将项目打包分发给团队成员

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PACKAGE_NAME="智学伴项目-$(date +%Y%m%d-%H%M%S)"
PACKAGE_DIR="$PROJECT_ROOT/packages"
OUTPUT_ZIP="$PACKAGE_DIR/$PACKAGE_NAME.zip"
TEMP_DIR=$(mktemp -d)

# 创建打包目录
mkdir -p "$PACKAGE_DIR"

echo "开始打包项目..."
echo "项目根目录: $PROJECT_ROOT"
echo "临时目录: $TEMP_DIR"

# 清理函数
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# 复制文件函数
copy_with_exclude() {
    local src="$1"
    local dest="$2"
    
    if [ ! -e "$src" ]; then
        echo "警告: 源路径不存在: $src"
        return
    fi
    
    if [ -d "$src" ]; then
        # 使用 rsync 复制目录，排除不需要的文件
        rsync -av --exclude='node_modules' \
                  --exclude='__pycache__' \
                  --exclude='*.pyc' \
                  --exclude='*.pyo' \
                  --exclude='*.pyd' \
                  --exclude='venv' \
                  --exclude='.venv' \
                  --exclude='env' \
                  --exclude='ENV' \
                  --exclude='*.db' \
                  --exclude='*.sqlite' \
                  --exclude='*.sqlite3' \
                  --exclude='*.db-journal' \
                  --exclude='logs' \
                  --exclude='*.log' \
                  --exclude='.env' \
                  --exclude='.env.local' \
                  --exclude='dist' \
                  --exclude='build' \
                  --exclude='.pytest_cache' \
                  --exclude='.coverage' \
                  --exclude='htmlcov' \
                  --exclude='.eslintcache' \
                  --exclude='*.tmp' \
                  --exclude='*.temp' \
                  --exclude='*.bak' \
                  --exclude='*.backup' \
                  --exclude='.DS_Store' \
                  --exclude='.vscode' \
                  --exclude='.idea' \
                  --exclude='*.swp' \
                  --exclude='*.swo' \
                  --exclude='uploads' \
                  --exclude='reports' \
                  --exclude='*.egg-info' \
                  "$src/" "$dest/"
    else
        cp "$src" "$dest"
    fi
}

# 复制根目录文件
echo ""
echo "正在复制根目录文件..."
for file in README.md DEVELOPMENT.md LICENSE .gitignore docker-compose.yml \
            API_KEY_SECURITY_CHECK.md GITHUB_PROFILE_README.md; do
    if [ -e "$PROJECT_ROOT/$file" ]; then
        echo "  复制: $file"
        cp "$PROJECT_ROOT/$file" "$TEMP_DIR/"
    fi
done

# 复制后端目录
if [ -d "$PROJECT_ROOT/backend" ]; then
    echo "正在复制后端目录..."
    copy_with_exclude "$PROJECT_ROOT/backend" "$TEMP_DIR/backend"
fi

# 复制前端目录
if [ -d "$PROJECT_ROOT/frontend" ]; then
    echo "正在复制前端目录..."
    copy_with_exclude "$PROJECT_ROOT/frontend" "$TEMP_DIR/frontend"
fi

# 创建打包说明文件
cat > "$TEMP_DIR/打包说明.txt" << EOF
# 项目打包说明

打包时间: $(date '+%Y-%m-%d %H:%M:%S')
打包版本: $PACKAGE_NAME

## 重要提示

1. 此打包文件不包含以下内容：
   - node_modules/ (需要运行 npm install)
   - Python 虚拟环境 (需要创建 venv)
   - 数据库文件 (*.db, *.sqlite)
   - 环境变量文件 (.env)
   - 构建产物 (dist/, build/)

2. 解压后请按照以下步骤操作：

### 后端设置
\`\`\`bash
cd backend
cp .env.template .env
# 编辑 .env 文件，填入你的配置
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
\`\`\`

### 前端设置
\`\`\`bash
cd frontend
npm install
\`\`\`

### 启动项目
\`\`\`bash
# 后端 (在 backend 目录)
uvicorn main:app --reload --port 8000

# 前端 (在 frontend 目录，新终端)
npm run dev
\`\`\`

3. 详细说明请查看项目根目录的 README.md 文件

4. 如有问题，请参考 DEVELOPMENT.md 文档
EOF

# 压缩文件
echo ""
echo "正在压缩文件..."
cd "$TEMP_DIR"
zip -r "$OUTPUT_ZIP" . > /dev/null

# 显示结果
ZIP_SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)
echo ""
echo "打包完成！"
echo "输出文件: $OUTPUT_ZIP"
echo "文件大小: $ZIP_SIZE"
echo ""
echo "可以分发给团队成员了！"
