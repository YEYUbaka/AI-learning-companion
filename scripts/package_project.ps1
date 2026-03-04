# 项目打包脚本 (PowerShell)
# 用于将项目打包分发给团队成员

$ErrorActionPreference = "Stop"

# 配置
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackageName = "智学伴项目-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$PackageDir = Join-Path $ProjectRoot "packages"
$OutputZip = Join-Path $PackageDir "$PackageName.zip"

# 创建打包目录
if (-not (Test-Path $PackageDir)) {
    New-Item -ItemType Directory -Path $PackageDir | Out-Null
}

# 临时打包目录
$TempPackageDir = Join-Path $env:TEMP $PackageName
if (Test-Path $TempPackageDir) {
    Remove-Item -Recurse -Force $TempPackageDir
}
New-Item -ItemType Directory -Path $TempPackageDir | Out-Null

Write-Host "开始打包项目..." -ForegroundColor Green
Write-Host "项目根目录: $ProjectRoot" -ForegroundColor Cyan
Write-Host "临时目录: $TempPackageDir" -ForegroundColor Cyan

# 需要包含的文件和目录
$IncludeItems = @(
    "README.md",
    "DEVELOPMENT.md",
    "LICENSE",
    ".gitignore",
    "docker-compose.yml",
    "API_KEY_SECURITY_CHECK.md",
    "GITHUB_PROFILE_README.md",
    "backend",
    "frontend"
)

# 需要排除的文件和目录模式
$ExcludePatterns = @(
    "node_modules",
    "__pycache__",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    "venv",
    ".venv",
    "env",
    "ENV",
    "*.db",
    "*.sqlite",
    "*.sqlite3",
    "*.db-journal",
    "logs",
    "*.log",
    ".env",
    ".env.local",
    "dist",
    "build",
    ".pytest_cache",
    ".coverage",
    "htmlcov",
    ".eslintcache",
    "*.tmp",
    "*.temp",
    "*.bak",
    "*.backup",
    ".DS_Store",
    ".vscode",
    ".idea",
    "*.swp",
    "*.swo",
    "uploads",
    "reports",
    "*.egg-info"
)

# 复制文件函数
function Copy-ProjectFiles {
    param (
        [string]$Source,
        [string]$Destination,
        [string[]]$ExcludePatterns
    )
    
    if (-not (Test-Path $Source)) {
        Write-Warning "源路径不存在: $Source"
        return
    }
    
    $item = Get-Item $Source
    if ($item.PSIsContainer) {
        # 目录
        $destDir = Join-Path $Destination $item.Name
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir | Out-Null
        }
        
        Get-ChildItem -Path $Source -Recurse | ForEach-Object {
            $relativePath = $_.FullName.Substring($Source.Length + 1)
            $shouldExclude = $false
            
            foreach ($pattern in $ExcludePatterns) {
                if ($relativePath -like "*$pattern*" -or $_.Name -like $pattern) {
                    $shouldExclude = $true
                    break
                }
            }
            
            if (-not $shouldExclude) {
                $destPath = Join-Path $destDir $relativePath
                $destParent = Split-Path -Parent $destPath
                
                if (-not (Test-Path $destParent)) {
                    New-Item -ItemType Directory -Path $destParent -Force | Out-Null
                }
                
                if (-not $_.PSIsContainer) {
                    Copy-Item -Path $_.FullName -Destination $destPath -Force
                }
            }
        }
    } else {
        # 文件
        Copy-Item -Path $Source -Destination $Destination -Force
    }
}

# 复制文件
Write-Host "`n正在复制文件..." -ForegroundColor Yellow
foreach ($item in $IncludeItems) {
    $sourcePath = Join-Path $ProjectRoot $item
    Write-Host "  复制: $item" -ForegroundColor Gray
    
    if ($item -eq "backend" -or $item -eq "frontend") {
        # 对于目录，需要特殊处理排除规则
        Copy-ProjectFiles -Source $sourcePath -Destination $TempPackageDir -ExcludePatterns $ExcludePatterns
    } else {
        if (Test-Path $sourcePath) {
            Copy-Item -Path $sourcePath -Destination $TempPackageDir -Force
        }
    }
}

# 创建打包说明文件
$PackageReadme = @"
# 项目打包说明

打包时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
打包版本: $PackageName

## 重要提示

1. 此打包文件不包含以下内容：
   - node_modules/ (需要运行 npm install)
   - Python 虚拟环境 (需要创建 venv)
   - 数据库文件 (*.db, *.sqlite)
   - 环境变量文件 (.env)
   - 构建产物 (dist/, build/)

2. 解压后请按照以下步骤操作：

### 后端设置
```bash
cd backend
cp .env.template .env
# 编辑 .env 文件，填入你的配置
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
```

### 前端设置
```bash
cd frontend
npm install
```

### 启动项目
```bash
# 后端 (在 backend 目录)
uvicorn main:app --reload --port 8000

# 前端 (在 frontend 目录，新终端)
npm run dev
```

3. 详细说明请查看项目根目录的 README.md 文件

4. 如有问题，请参考 DEVELOPMENT.md 文档
"@

$PackageReadme | Out-File -FilePath (Join-Path $TempPackageDir "打包说明.txt") -Encoding UTF8

# 压缩文件
Write-Host "`n正在压缩文件..." -ForegroundColor Yellow
if (Test-Path $OutputZip) {
    Remove-Item -Force $OutputZip
}

# 使用 .NET 压缩功能
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($TempPackageDir, $OutputZip)

# 清理临时目录
Remove-Item -Recurse -Force $TempPackageDir

# 显示结果
$zipSize = (Get-Item $OutputZip).Length / 1MB
Write-Host "`n打包完成！" -ForegroundColor Green
Write-Host "输出文件: $OutputZip" -ForegroundColor Cyan
Write-Host "文件大小: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan
Write-Host "`n可以分发给团队成员了！" -ForegroundColor Green
