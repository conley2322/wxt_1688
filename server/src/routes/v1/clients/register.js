// 客户端注册（昵称免注册：token 由扩展端生成，首次连接 upsert，之后改昵称）
import { Router } from 'express'

const router = Router()

// POST /api/v1/clients
router.post('/', (req, res) => {
  const token = req.headers['x-client-token'] || req.body?.token
  const nickname = String(req.body?.nickname || '').trim().slice(0, 20)
  if (!token) return res.status(400).json({ code: 400, message: '缺少客户端令牌' })
  if (!nickname) return res.status(400).json({ code: 400, message: '昵称不能为空' })

  req.db.run(
    `INSERT INTO clients (token, nickname, created_at) VALUES (?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET nickname = excluded.nickname`,
    token, nickname, Date.now()
  )
  res.json({ code: 200, data: { token, nickname }, message: '注册成功' })
})

export default router
