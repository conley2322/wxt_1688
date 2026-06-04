import { Router } from 'express'
const router = Router()

// GET /api/v1/tags/pool
router.get('/', (req, res) => {
  try {
    const user_id = req.user.id
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.page_size) || 20
    const offset = (page - 1) * pageSize

    const total = req.db.get(
      'SELECT COUNT(*) as count FROM tags WHERE creator_id = ?',
      [user_id]
    ).count
    
    const tags = req.db.query(
      `SELECT id, text, font_color, bg_color, visibility, creator, created_at
       FROM tags
       WHERE creator_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [user_id, pageSize, offset]
    )
    
    res.json({ code: 200, data: tags, total, page, page_size: pageSize })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router