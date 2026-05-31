import { Router } from 'express'
const router = Router()

// POST /api/v1/tags
router.post('/', (req, res) => {
  try {
    const { text, font_color, bg_color, visibility } = req.body
    const username = req.user.username

    if (!text || !text.trim()) {
      return res.status(400).json({ code: 400, message: '标签名不能为空' })
    }
    if (text.trim().length > 10) {
      return res.status(400).json({ code: 400, message: '标签名不能超过10个字' })
    }

    const id = crypto.randomUUID()
    req.db.run(
      'INSERT INTO tags (id, text, font_color, bg_color, visibility, creator, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, text.trim(), font_color || '#fff', bg_color || '#1677ff', visibility || 'public', username, req.user.id]
    )

    res.json({
      code: 200,
      data: {
        id,
        text: text.trim(),
        font_color: font_color || '#fff',
        bg_color: bg_color || '#1677ff',
        visibility: visibility || 'public',
        creator: username,
        created_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
