import { Router } from 'express'
const router = Router({ mergeParams: true })

// GET /api/v1/products/:offer_id/comments
router.get('/', (req, res) => {
  try {
    const { offer_id } = req.params
    const comments = req.db.query(
      `SELECT pc.id, pc.user_id, u.username, u.avatar_color, pc.text, pc.img, pc.created_at, pc.updated_at
       FROM product_comments pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.offer_id = ?
       ORDER BY pc.created_at DESC`,
      [offer_id]
    )
    res.json({ code: 200, data: comments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
