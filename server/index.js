import https from 'https'
import http from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import app from './src/app.js'
import config from './src/config/index.js'
import { ensureCert } from './src/utils/ensureCert.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 确保证书存在（没有则自动调 mkcert 生成）
ensureCert()

const CERT_FILE = path.join(__dirname, 'localhost+2.pem')
const KEY_FILE = path.join(__dirname, 'localhost+2-key.pem')

const hasCert = fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)

// 获取本机局域网 IP
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

const host = getLocalIP()

if (hasCert) {
  const options = {
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE)
  }
  https.createServer(options, app).listen(config.port, () => {
    console.log(`✅ Server running at https://${host}:${config.port}`)
  })
} else {
  console.warn('⚠️  证书不可用，降级为 HTTP（仅限开发）')
  app.listen(config.port, () => {
    console.log(`⚠️  Server running at http://${host}:${config.port}`)
  })
}
