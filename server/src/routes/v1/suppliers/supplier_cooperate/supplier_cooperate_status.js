import { Router } from 'express'
const router = Router()

// GET /api/v1/suppliers/cooperate/status?supplier_name=xxx
router.get('/status', (req, res) => {
  try {
    const { supplier_name } = req.query
    const user_id = req.user.id

    if (!supplier_name) {
      return res.status(400).json({ code: 400, message: '缺少 supplier_name' })
    }

    const supplier = req.db.get('SELECT id FROM suppliers WHERE name = ?', [supplier_name.trim()])
    if (!supplier) {
      return res.json({ code: 200, data: { cooperated: false } })
    }

    const record = req.db.get(
      'SELECT id FROM supplier_cooperations WHERE supplier_id = ? AND user_id = ?',
      [supplier.id, user_id]
    )

    res.json({ code: 200, data: { cooperated: !!record } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
