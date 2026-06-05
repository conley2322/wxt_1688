import express from 'express'
import cors from 'cors'
import config from './config/index.js'
import { errorHandler, logger } from './middlewares/index.js'
import router from './routes/index.js'
import db from './config/database.js'
import './database/init.js'

const app = express()

// Middlewares
app.use(cors(config.cors))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// 静态文件：上传的图片
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadPath = path.join(__dirname, '../uploads')
// console.log('[app] 静态文件目录:', uploadPath)
app.use('/uploads', express.static(uploadPath))
// 挂载 db 到 req
app.use((req, res, next) => {
    req.user_id = req.body.user_id || null,
        req.db = {
            // 查询多条
            query: (sql, params = []) => db.prepare(sql).all(...params),
            // 查询单条
            get: (sql, params = []) => db.prepare(sql).get(...params),
            // 执行增删改
            run: (sql, params = []) => db.prepare(sql).run(...params)
        }
    next()
})
app.use(logger)

// 注册路由
app.use('/api', router)

// Error Handler
app.use(errorHandler)

export default app
