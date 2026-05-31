import { Router } from 'express'
const router = Router({ mergeParams: true })

// POST /api/v1/products/:offer_id/comments
router.post('/', (req, res) => {
  try {
    const { offer_id } = req.params
    const { text } = req.body
    const user_id = req.user.id

    if (!text || !text.trim()) {
      return res.status(400).json({ code: 400, message: '评论内容不能为空' })
    }

    const id = crypto.randomUUID()
    req.db.run(
      'INSERT INTO product_comments (id, offer_id, user_id, text) VALUES (?, ?, ?, ?)',
      [id, offer_id, user_id, text.trim()]
    )

    res.json({
      code: 200,
      data: { id, text: text.trim(), created_at: new Date().toISOString() }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
