/**
 * 确保证书文件存在，不存在则自动调用 mkcert 生成。
 * CA 未安装到系统信任链时给出提示（macOS 需 sudo，Win 需管理员）。
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_ROOT = path.resolve(__dirname, '../../')

const CERT_FILE = path.join(SERVER_ROOT, 'localhost+2.pem')
const KEY_FILE = path.join(SERVER_ROOT, 'localhost+2-key.pem')

// ── 查找 mkcert ────────────────────────────────────────────
function findMkcert() {
  // 1) 项目内置
  const ext = process.platform === 'win32' ? '.exe' : ''
  const bundled = path.join(SERVER_ROOT, 'certs', `mkcert${ext}`)
  if (fs.existsSync(bundled)) return bundled

  // 2) 系统 PATH
  try {
    const which = process.platform === 'win32' ? 'where' : 'which'
    const found = execSync(`${which} mkcert`, { encoding: 'utf8', timeout: 3000 }).trim().split('\n')[0]
    if (found && fs.existsSync(found)) return found
  } catch { /* not in PATH */ }

  return null
}

// ── 获取本机局域网 IP ──────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

// ── 检查 CA 是否已安装 ─────────────────────────────────────
function isCAInstalled(mkcertPath) {
  try {
    const result = execSync(`"${mkcertPath}" -CAROOT`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    return result.length > 0 && fs.existsSync(result)
  } catch {
    return false
  }
}

// ── 生成证书 ───────────────────────────────────────────────
function generateCert(mkcertPath) {
  const localIP = getLocalIP()
  const names = ['localhost', '127.0.0.1']
  if (localIP !== '127.0.0.1') names.push(localIP)

  console.log(`[cert] 生成证书，覆盖域名: ${names.join(', ')}`)

  const result = spawnSync(
    mkcertPath,
    ['-cert-file', CERT_FILE, '-key-file', KEY_FILE, ...names],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 }
  )

  if (result.status !== 0) {
    const errMsg = result.stderr || result.stdout || '未知错误'
    throw new Error(`mkcert 执行失败: ${errMsg}`)
  }

  console.log('[cert] 证书生成成功')
}

// ── 打印 CA 安装提示 ───────────────────────────────────────
function printCAInstallHint(mkcertPath) {
  const cmd = `"${mkcertPath}" -install`
  const divider = '═'.repeat(60)

  console.log(`\n${divider}`)
  console.log('⚠️  本地 CA 未安装到系统信任链，浏览器会报证书错误')
  console.log(`${divider}`)

  if (process.platform === 'darwin') {
    console.log('👉 macOS 请在终端运行（需要输入密码）:')
    console.log(`   sudo ${cmd}`)
  } else if (process.platform === 'win32') {
    console.log('👉 Windows 请以管理员身份运行:')
    console.log(`   ${cmd}`)
    console.log('   （会弹出 UAC 确认窗口）')
  } else {
    console.log(`👉 请运行: ${cmd}`)
  }
  console.log(`${divider}\n`)
}

// ── 主入口 ─────────────────────────────────────────────────
export function ensureCert() {
  // 证书已存在，直接返回
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    return
  }

  console.log('[cert] 证书文件不存在，尝试自动生成...')

  const mkcertPath = findMkcert()
  if (!mkcertPath) {
    console.error('[cert] ❌ 未找到 mkcert，请先安装:')
    console.error('   macOS:  brew install mkcert')
    console.error('   Windows: choco install mkcert  或 从 https://github.com/FiloSottile/mkcert/releases 下载')
    console.error('   然后将可执行文件放到 server/certs/mkcert (macOS/Linux) 或 server/certs/mkcert.exe (Windows)')
    // 不阻止启动，让后面的 fs.readFileSync 报具体错误
    return
  }

  console.log(`[cert] 使用 mkcert: ${mkcertPath}`)

  // 生成证书（无需管理员权限）
  try {
    generateCert(mkcertPath)
  } catch (e) {
    console.error(`[cert] 生成失败: ${e.message}`)
    return
  }

  // 检查 CA 是否已安装
  if (!isCAInstalled(mkcertPath)) {
    printCAInstallHint(mkcertPath)
  }
}
