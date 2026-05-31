import { Router } from 'express'
const router = Router()

// GET /api/v1/tags/pool
router.get('/', (req, res) => {
  try {
    const user_id = req.user.id
    const tags = req.db.query(
      `SELECT id, text, font_color, bg_color, visibility, creator, created_at
       FROM tags
       WHERE creator_id = ?
       ORDER BY created_at DESC`,
      [user_id]
    )
    res.json({ code: 200, data: tags })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
