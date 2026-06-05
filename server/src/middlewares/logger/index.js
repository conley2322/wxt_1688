import db from '../../config/database.js'
import crypto from 'crypto'

/**
 * 操作日志中间件
 * - 只在路由设置了 req.logDetail 时才记录
 * - detail 为可读描述文本，如 "张三 给商品「CS-B17」添加了评论"
 */
export const logger = (req, res, next) => {
  const cleanup = () => {
    res.removeListener('finish', log)
    res.removeListener('close', log)
  }
  const log = () => {
    cleanup()
    if (!req.logDetail) return
    try {
      const id = crypto.randomUUID()
      const ip = req.ip || req.connection?.remoteAddress || null
      const userId = req.user?.id || null
      const username = req.user?.username || null

      db.prepare(`
        INSERT INTO operation_logs (id, user_id, username, action, detail, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        username,
        `${req.method} ${req.path}`,
        req.logDetail,
        ip
      )
    } catch (err) {
      console.error('[logger] 写入失败:', err.message)
    }
  }

  res.on('finish', log)
  res.on('close', log)
  next()
}
