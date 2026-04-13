$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$hooksPath = Join-Path $repoRoot '.githooks'

if (-not (Test-Path $hooksPath)) {
    throw "未找到 Git hooks 目录: $hooksPath"
}

git -C $repoRoot config core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
    throw "设置 core.hooksPath 失败"
}

Write-Host "[OK] 已启用仓库内 Git hooks"
Write-Host "[INFO] 提交后如存在未推送 commit，将提示执行: git push origin HEAD"
