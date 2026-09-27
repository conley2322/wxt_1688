// Express 入口
import express from 'express'
import cors from 'cors'
import routes from './routes/index.js'
import { dbMiddleware } from './middleware/index.js'
import { config } from './config/index.js'

const app = express()

app.use(cors()) // 局域网内任意机器可访问（反射请求来源）
app.use(express.json({ limit: '20mb' })) // 批量同步可能携带较多流水
app.use(dbMiddleware)
app.use(routes)

// 根路径健康检查（扩展端测试连接用）
app.get('/', (_req, res) => {
  res.json({ code: 200, data: { name: 'ALOCS-1688 Server', version: '0.4.0' } })
})

app.listen(config.port, () => {
  console.log(`[ALOCS-Server] 已启动 — http://0.0.0.0:${config.port}`)
})
