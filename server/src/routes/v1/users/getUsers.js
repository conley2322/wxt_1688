import { Router } from 'express'
const router = Router()

router.get('/', (req, res, next) => {
  try {
    const users = req.db.query('SELECT id, username, email, color, status, role, created_at FROM users')
    res.json({ code: 200, data: users, message: '获取用户列表成功' })
  } catch (error) {
    next(error)
  }
})

export default router