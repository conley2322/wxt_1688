import { Router } from 'express'
const router = Router()

// GET /api/v1/suppliers/tags?supplier_name=xxx
router.get('/', (req, res) => {
  try {
    const { supplier_name } = req.query
    const user_id = req.user.id

    if (!supplier_name) {
      return res.status(400).json({ code: 400, message: '缺少 supplier_name' })
    }

    const username = req.user.username

    // 我的标签
    const mine = req.db.query(
      `SELECT t.id, t.text, t.font_color, t.bg_color, t.visibility, st.assigned_at
       FROM supplier_tags st
       JOIN tags t ON st.tag_id = t.id
       JOIN suppliers s ON st.supplier_id = s.id
       WHERE s.name = ? AND st.tag_user = ?`,
      [supplier_name, user_id]
    )
    const mineWithCreator = mine.map(t => ({ ...t, creator: username }))

    // 其他人的标签（只显示 public 标签）
    const others = req.db.query(
      `SELECT t.id, t.text, t.font_color, t.bg_color, t.visibility, st.assigned_at, u.username AS creator
       FROM supplier_tags st
       JOIN tags t ON st.tag_id = t.id
       JOIN suppliers s ON st.supplier_id = s.id
       JOIN users u ON st.tag_user = u.id
       WHERE s.name = ? AND st.tag_user != ? AND t.visibility = 'public'`,
      [supplier_name, user_id]
    )

    res.json({ code: 200, data: { mine: mineWithCreator, others } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
