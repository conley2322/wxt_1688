import { Router } from 'express'
const router = Router()

router.get('/', (req, res) => {
  try {
    const users = req.db.query('SELECT id, username, email, role, status, created_at FROM users ORDER BY id')
    res.json({ code: 200, data: users })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
