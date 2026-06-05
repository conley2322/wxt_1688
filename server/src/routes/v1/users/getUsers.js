import { Router } from 'express'
const router = Router()

router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.page_size) || 20
    const offset = (page - 1) * pageSize

    const total = req.db.get('SELECT COUNT(*) as count FROM users').count
    const users = req.db.query(
      'SELECT id, username, email, avatar, avatar_color, role, status, created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    )
    
    res.json({ code: 200, data: users, total, page, page_size: pageSize })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router