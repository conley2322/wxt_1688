# ============================================================
#  ALOCS-1688 单机版 · 一键升级（Windows / PowerShell）
#  作用：下载 GitHub 最新版 → 覆盖已装扩展目录 → 数据完整保留
#  原理：扩展 ID 固定为 jfmjpidelkddbbfdjaopimehhconoekm，
#        只换文件、不改 ID、不动目录名，IndexedDB 数据原地保留。
# ============================================================

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$ExtId = 'jfmjpidelkddbbfdjaopimehhconoekm'
$Repo  = 'conley2322/wxt_1688'
$Api   = "https://api.github.com/repos/$Repo/releases/latest"

function Say($m) { Write-Host $m }
function Ok($m)  { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Die($m) { Write-Host ""; Write-Host "[X] $m" -ForegroundColor Red; Write-Host ""; Read-Host "按回车键关闭"; exit 1 }

Say ""
Say "=============================================="
Say "  ALOCS-1688 单机版 - 一键升级"
Say "=============================================="
Say ""

# ---------- 1. 定位已安装扩展 ----------
Say "[1/5] 查找已安装的扩展..."

$roots = @(
  (Join-Path $env:LOCALAPPDATA 'Tencent\QQBrowser\User Data\Default'),
  (Join-Path $env:APPDATA      'Tencent\QQBrowser\User Data\Default'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default'),
  (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data\Default')
)

$Target = $null
foreach ($r in $roots) {
  $base = Join-Path $r "Extensions\$ExtId"
  if (-not (Test-Path $base)) { continue }
  $cand = Get-ChildItem $base -Directory | Where-Object { $_.Name -notlike '*.bak*' -and (Test-Path (Join-Path $_.FullName 'manifest.json')) } |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($cand) { $Target = $cand.FullName; Ok "找到：$Target"; break }
}

if (-not $Target) {
  Say ""
  Warn "没有自动找到扩展目录。"
  Say "   如果你是把解压后的文件夹放在别处手动加载的，请把该文件夹拖到本窗口后回车，或直接粘贴路径："
  $manual = Read-Host "   路径"
  $manual = $manual.Trim('"').Trim()
  if (-not (Test-Path (Join-Path $manual 'manifest.json'))) { Die "该路径下没有 manifest.json，无法确认是扩展目录。" }
  $Target = $manual
  Ok "使用：$Target"
}

$curVer = (Get-Content (Join-Path $Target 'manifest.json') -Raw | ConvertFrom-Json).version
Say "     当前版本：$curVer"

# ---------- 2. 查询最新版本 ----------
Say ""
Say "[2/5] 查询 GitHub 最新版本..."

$rel = $null
for ($i=1; $i -le 3; $i++) {
  try { $rel = Invoke-RestMethod -Uri $Api -TimeoutSec 25 -UseBasicParsing; break }
  catch { Start-Sleep -Seconds 1 }
}
if (-not $rel) { Die "访问 GitHub 失败（网络不通）。稍后重试，或手动从 Releases 页下载 zip 后运行本脚本。" }

$newVer = $rel.tag_name.TrimStart('v')
$asset  = $rel.assets | Where-Object { $_.name -like '*-chrome.zip' } | Select-Object -First 1
if (-not $asset) { Die "最新版本里没有找到 zip 安装包。" }

Say "     最新版本：$newVer"

if ($curVer -eq $newVer) {
  Say ""
  Ok "已经是最新版本（$curVer），无需升级。"
  Say ""
  Read-Host "按回车键关闭"
  exit 0
}

# ---------- 3. 下载 ----------
Say ""
Say "[3/5] 下载 $newVer ..."
$tmp = Join-Path $env:TEMP ("alocs-update-" + (Get-Random))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$zip = Join-Path $tmp 'pkg.zip'

$mirrors = @('', 'https://gh-proxy.com/', 'https://ghfast.top/')
$ok = $false
foreach ($m in $mirrors) {
  $url = "$m$($asset.browser_download_url)"
  for ($a=1; $a -le 3; $a++) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $zip -TimeoutSec 180 -UseBasicParsing
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [IO.Compression.ZipFile]::OpenRead($zip).Dispose()
      $ok = $true; break
    } catch { Start-Sleep -Seconds 1 }
  }
  if ($ok) { break }
}
if (-not $ok) { Die "下载失败（网络不稳）。可手动从 Releases 页下载 zip 后在网络通畅时重试。" }
Ok "下载完成（$([math]::Round((Get-Item $zip).Length/1MB,2)) MB）"

# ---------- 4. 解压 + 备份 + 覆盖 ----------
Say ""
Say "[4/5] 安装（原目录、原扩展 ID，数据不动）..."

$src = Join-Path $tmp 'pkg'
Expand-Archive -Path $zip -DestinationPath $src -Force
if (-not (Test-Path (Join-Path $src 'manifest.json')) -and (Test-Path (Join-Path $src 'chrome-mv3\manifest.json'))) {
  $src = Join-Path $src 'chrome-mv3'
}
if (-not (Test-Path (Join-Path $src 'manifest.json'))) { Die "安装包里没有 manifest.json，包结构异常。" }

# 校验新包 ID，避免装成另一个扩展
$m = Get-Content (Join-Path $src 'manifest.json') -Raw | ConvertFrom-Json
if ($m.key) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $hash = $sha.ComputeHash([Convert]::FromBase64String($m.key))
  $alpha = 'abcdefghijklmnop'
  $pkgId = ($hash[0..15] | ForEach-Object { $alpha[($_ -shr 4) -band 0xf] + $alpha[$_ -band 0xf] }) -join ''
  if ($pkgId -ne $ExtId) { Die "安装包 ID ($pkgId) 与现有扩展 ($ExtId) 不一致，装上去会变成另一个扩展、看不到老数据。已中止。" }
  Ok "包 ID 校验通过"
}

$bak = "$Target.bak." + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item $Target $bak -Recurse -Force
Ok "已备份：$(Split-Path $bak -Leaf)"

# 整目录覆盖：目录名与路径不动 -> ID 不变 -> 数据保留
Get-ChildItem $Target -Force | Remove-Item -Recurse -Force
Copy-Item (Join-Path $src '*') $Target -Recurse -Force

# 本地解压加载不需要 key
$mf = Join-Path $Target 'manifest.json'
$obj = Get-Content $mf -Raw | ConvertFrom-Json
$obj.PSObject.Properties.Remove('key')
$obj | ConvertTo-Json -Depth 10 | Set-Content $mf -Encoding UTF8

$installed = (Get-Content $mf -Raw | ConvertFrom-Json).version
Ok "安装完成，当前版本：$installed"

# ---------- 5. 生效 ----------
Say ""
Say "[5/5] 让新版本生效"
Say ""
Say "  扩展已换成新版，数据（笔记/聊天/供应商档案）都在原来的库里。"
Say "  还需要让浏览器重新加载一次："
Say "    1) 打开 chrome://extensions（QQ 浏览器：qqbrowser://extensions）"
Say "    2) 找到 ALOCS-1688 单机版，点刷新按钮"
Say ""

Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

Say "=============================================="
Say "  升级完成：$curVer -> $installed"
Say "=============================================="
Say ""
Say "  备份目录（确认没问题后可删）：$bak"
Say ""
Read-Host "按回车键关闭"
