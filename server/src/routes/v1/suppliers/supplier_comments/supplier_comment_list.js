import { Router } from 'express'
const router = Router()

// GET /api/v1/suppliers/comments?supplier_name=xxx
router.get('/', (req, res) => {
  try {
    const { supplier_name } = req.query
    if (!supplier_name) {
      return res.status(400).json({ code: 400, message: '缺少 supplier_name' })
    }

    const comments = req.db.query(
      `SELECT sc.id, sc.user_id, u.username, u.avatar_color, sc.text, sc.created_at, sc.updated_at
       FROM supplier_comments sc
       JOIN users u ON sc.user_id = u.id
       JOIN suppliers s ON sc.supplier_id = s.id
       WHERE s.name = ?
       ORDER BY sc.created_at DESC`,
      [supplier_name]
    )
    res.json({ code: 200, data: comments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
