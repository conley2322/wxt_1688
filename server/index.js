import http from 'http'
import os from 'os'
import app from './src/app.js'
import config from './src/config/index.js'

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

http.createServer(app).listen(config.port, '0.0.0.0', () => {
  console.log(`✅ Server running at:`)
  console.log(`   本机:   http://localhost:${config.port}`)
  console.log(`   局域网: http://${host}:${config.port}`)

  // ── 生产环境：启动后静默 console.log / console.debug ──
  if (config.isProduction) {
    const noop = () => {}
    console.debug = noop
    console.log = noop
    // 保留 console.warn / console.error
  }
})
