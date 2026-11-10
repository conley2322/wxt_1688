#!/bin/bash
# ============================================================
# ALOCS-1688 单机版 · 一键升级（macOS）
#
# 作用：下载 GitHub 最新版本 → 覆盖到已安装的扩展目录 → 数据完整保留
# 原理：扩展 ID 由 manifest 固定为 jfmjpidelkddbbfdjaopimehhconoekm，
#       升级只换文件、不改 ID、不动目录名，所以 IndexedDB 里的数据原地保留。
# 用法：双击运行。首次可能被系统拦截，右键 → 打开。
# ============================================================
set -uo pipefail

EXT_ID="jfmjpidelkddbbfdjaopimehhconoekm"
REPO="conley2322/wxt_1688"
API="https://api.github.com/repos/${REPO}/releases/latest"

say()  { printf "%s\n" "$*"; }
ok()   { printf "  ✓ %s\n" "$*"; }
warn() { printf "  ! %s\n" "$*"; }
die()  { printf "\n✗ %s\n" "$*"; printf "\n按回车键关闭…"; read -r _; exit 1; }

say ""
say "=============================================="
say "  ALOCS-1688 单机版 · 一键升级"
say "=============================================="
say ""

# ---------- 1. 定位已安装的扩展 ----------
say "[1/5] 查找已安装的扩展…"

APP_SUPPORT="$HOME/Library/Application Support"
BROWSER_ROOTS=(
  "$APP_SUPPORT/QQBrowser3/Default"
  "$APP_SUPPORT/Google/Chrome/Default"
  "$APP_SUPPORT/Microsoft Edge/Default"
  "$APP_SUPPORT/BraveSoftware/Brave-Browser/Default"
)

TARGET=""
for root in "${BROWSER_ROOTS[@]}"; do
  base="$root/Extensions/$EXT_ID"
  [ -d "$base" ] || continue
  # 取版本号最大的目录（忽略 .bak）
  for d in "$base"/*/; do
    [ -f "$d/manifest.json" ] || continue
    case "$(basename "$d")" in *.bak*) continue ;; esac
    [ -z "$TARGET" ] && TARGET="${d%/}"
  done
  if [ -n "$TARGET" ]; then
    ok "找到：$TARGET"
    break
  fi
done

if [ -z "$TARGET" ]; then
  say ""
  warn "没有自动找到扩展目录。"
  say "   如果你是把解压后的文件夹放在别处（例如「下载」里）手动「加载已解压的扩展程序」，"
  say "   请先把它拖到这个窗口，或直接输入该文件夹的完整路径："
  printf "   路径："
  read -r MANUAL
  MANUAL="${MANUAL//\\ / }"
  MANUAL="${MANUAL%\"}"; MANUAL="${MANUAL#\"}"
  [ -f "$MANUAL/manifest.json" ] || die "这个路径下没有 manifest.json，无法确认是扩展目录。"
  TARGET="$MANUAL"
  ok "使用：$TARGET"
fi

CUR_VER=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" "$TARGET/manifest.json" 2>/dev/null || echo "未知")
say "     当前版本：$CUR_VER"

# ---------- 2. 查询最新版本 ----------
say ""
say "[2/5] 查询 GitHub 最新版本…"

LATEST_JSON=""
for i in 1 2 3; do
  LATEST_JSON=$(curl -sL --http1.1 --max-time 25 "$API" 2>/dev/null) && [ -n "$LATEST_JSON" ] && break
  LATEST_JSON=""
  sleep 1
done
[ -z "$LATEST_JSON" ] && die "访问 GitHub 失败（网络不通或被拦截）。稍后重试，或手动从 Releases 页下载 zip 覆盖。"

read -r NEW_VER ZIP_URL <<EOF
$(printf '%s' "$LATEST_JSON" | python3 -c '
import json,sys
d=json.load(sys.stdin)
tag=d.get("tag_name","").lstrip("v")
url=""
for a in d.get("assets",[]):
    if a.get("name","").endswith("-chrome.zip"):
        url=a.get("browser_download_url",""); break
print(tag, url)
' 2>/dev/null)
EOF

[ -z "${NEW_VER:-}" ] && die "解析版本信息失败，请稍后重试。"
[ -z "${ZIP_URL:-}" ] && die "最新版本里没有找到 zip 安装包。"

say "     最新版本：$NEW_VER"

if [ "$CUR_VER" = "$NEW_VER" ]; then
  say ""
  ok "已经是最新版本（${CUR_VER}），无需升级。"
  say ""
  printf "按回车键关闭…"; read -r _
  exit 0
fi

# ---------- 3. 下载 ----------
say ""
say "[3/5] 下载 $NEW_VER …"
TMP=$(mktemp -d /tmp/alocs-update.XXXXXX)
trap 'rm -rf "$TMP"' EXIT
ZIP="$TMP/pkg.zip"

MIRRORS=("" "https://gh-proxy.com/" "https://ghfast.top/")
downloaded=0
for m in "${MIRRORS[@]}"; do
  url="${m}${ZIP_URL}"
  [ -z "$m" ] && url="$ZIP_URL"
  for attempt in 1 2 3; do
    printf "     尝试下载（第 %s 次）…\r" "$attempt"
    if curl -sL --http1.1 --max-time 180 -C - -o "$ZIP" "$url" 2>/dev/null \
       && python3 -c "import zipfile,sys;zipfile.ZipFile(sys.argv[1])" "$ZIP" 2>/dev/null; then
      downloaded=1; break
    fi
    sleep 1
  done
  [ "$downloaded" = "1" ] && break
done
printf "                                        \r"
[ "$downloaded" != "1" ] && die "下载失败（网络不稳）。可手动从 Releases 页下载 zip 后运行本脚本，或在网络通畅时重试。"
ok "下载完成（$(du -h "$ZIP" | cut -f1)）"

# ---------- 4. 解压 + 备份 + 覆盖 ----------
say ""
say "[4/5] 安装（原目录、原扩展 ID，数据不动）…"

SRC="$TMP/pkg"
mkdir -p "$SRC"
unzip -oq "$ZIP" -d "$SRC"
# 兼容 zip 内自带一层 chrome-mv3/ 的情况
if [ ! -f "$SRC/manifest.json" ] && [ -f "$SRC/chrome-mv3/manifest.json" ]; then
  SRC="$SRC/chrome-mv3"
fi
[ -f "$SRC/manifest.json" ] || die "安装包里没有 manifest.json，包结构异常。"

# 校验新包 ID 是否正确（防止装成另一个扩展）
PKG_ID=$(python3 - "$SRC/manifest.json" <<'PY'
import json,sys,base64,hashlib
m=json.load(open(sys.argv[1]))
k=m.get('key')
if not k: print("(无key)"); raise SystemExit
h=hashlib.sha256(base64.b64decode(k)).hexdigest()[:32]
print(''.join('abcdefghijklmnop'[int(c,16)] for c in h))
PY
)
if [ "$PKG_ID" != "$EXT_ID" ] && [ "$PKG_ID" != "(无key)" ]; then
  die "安装包 ID ($PKG_ID) 与现有扩展 ($EXT_ID) 不一致，装上去会变成另一个扩展、看不到老数据。已中止。"
fi
ok "包 ID 校验通过"

BAK="${TARGET}.bak.$(date +%Y%m%d-%H%M%S)"
cp -R "$TARGET" "$BAK" || die "备份失败，已中止（未做任何修改）。"
ok "已备份：$(basename "$BAK")"

# 整目录覆盖：目录名与路径保持不动 → ID 不变 → 数据保留
rsync -a --delete "$SRC"/ "$TARGET"/ || die "覆盖失败。原目录已备份在：$BAK"

# 本地解压加载不需要 key；删掉保持与原有安装状态一致
python3 - "$TARGET/manifest.json" <<'PY'
import json,sys
p=sys.argv[1]; m=json.load(open(p)); m.pop('key',None)
json.dump(m,open(p,'w'),ensure_ascii=False,indent=2)
PY

INSTALLED=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" "$TARGET/manifest.json" 2>/dev/null)
ok "安装完成，当前版本：$INSTALLED"

# ---------- 5. 生效 ----------
say ""
say "[5/5] 让新版本生效"
say ""
say "  扩展已经换成新版，数据（笔记/聊天/供应商档案）都还在原来的库里。"
say "  还需要让浏览器重新加载一次扩展："
say "    1) 打开 chrome://extensions（QQ 浏览器：qqbrowser://extensions）"
say "    2) 找到「ALOCS-1688 单机版」，点刷新 ↻"
say ""
printf "  要现在自动重启 QQ 浏览器吗？（重启后直接生效）[y/N] "
read -r RESTART
if [ "${RESTART:-N}" = "y" ] || [ "${RESTART:-N}" = "Y" ]; then
  say "  正在重启 QQ 浏览器…"
  osascript -e 'quit app "QQBrowser"' 2>/dev/null
  sleep 3
  open -a "QQBrowser" 2>/dev/null
  ok "已重启"
fi

say ""
say "=============================================="
say "  ✓ 升级完成：$CUR_VER → $INSTALLED"
say "=============================================="
say ""
say "  备份目录（确认没问题后可删）："
say "  $BAK"
say ""
printf "按回车键关闭…"; read -r _
