import { Router } from 'express'
const router = Router()

router.get('/', (req, res, next) => {
  try {
    const user = req.db.get('SELECT id, username, email, color, status, role, created_at FROM users WHERE id = ?', [req.params.id])
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }
    res.json({ code: 200, data: user, message: '获取用户成功' })
  } catch (error) {
    next(error)
  }
})

export default router