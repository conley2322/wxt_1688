import { Router } from 'express'
const router = Router({ mergeParams: true })

// GET /api/v1/products/:offer_id/tags
router.get('/', (req, res) => {
  try {
    const { offer_id } = req.params
    const user_id = req.user.id
    const username = req.user.username

    // 我的标签（我打的标签，不管标签本身的 visibility）
    const mine = req.db.query(
      `SELECT t.id, t.text, t.font_color, t.bg_color, t.visibility, pt.assigned_at
       FROM product_tags pt
       JOIN tags t ON pt.tag_id = t.id
       WHERE pt.offer_id = ? AND pt.tag_user = ?`,
      [offer_id, user_id]
    )
    // 给我的标签加上 creator 标记（我自己）
    const mineWithCreator = mine.map(t => ({ ...t, creator: username }))

    // 其他人的标签（只看 public 标签，private 标签不显示）
    const others = req.db.query(
      `SELECT t.id, t.text, t.font_color, t.bg_color, t.visibility, pt.assigned_at, u.username AS creator
       FROM product_tags pt
       JOIN tags t ON pt.tag_id = t.id
       JOIN users u ON pt.tag_user = u.id
       WHERE pt.offer_id = ? AND pt.tag_user != ? AND t.visibility = 'public'`,
      [offer_id, user_id]
    )

    res.json({ code: 200, data: { mine: mineWithCreator, others } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
