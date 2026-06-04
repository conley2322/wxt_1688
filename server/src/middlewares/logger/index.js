import db from '../../config/database.js'
import crypto from 'crypto'

export const logger = (req, res, next) => {
    const now = new Date().toISOString()
   // console.log(`日志中间件：${now} ${req.method} ${req.path}`)

    // 写入 operation_logs 表
    try {
        const id = crypto.randomUUID()
        const ip_address = req.ip || req.connection?.remoteAddress || null
        db.prepare(
            'INSERT INTO operation_logs (id, user_id, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
            id,
            req.body?.user_id || null,
            `${req.method} ${req.path}`,
            null,
            null,
            JSON.stringify(req.body || {}),
            ip_address
        )
    } catch (err) {
        console.error('操作日志写入失败:', err.message)
    }

    next()
}
