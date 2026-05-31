import { Router } from 'express'
const router = Router()

// POST /api/v1/suppliers/cooperate
router.post('/', (req, res) => {
  try {
    const { supplier_name } = req.body
    const user_id = req.user.id

    if (!supplier_name) {
      return res.status(400).json({ code: 400, message: '缺少 supplier_name' })
    }

    // 获取供应商
    let supplier = req.db.get('SELECT id FROM suppliers WHERE name = ?', [supplier_name.trim()])
    if (!supplier) {
      return res.status(404).json({ code: 404, message: '供应商不存在，请先发表评论' })
    }

    // 查询当前合作状态
    const existing = req.db.get(
      'SELECT id FROM supplier_cooperations WHERE supplier_id = ? AND user_id = ?',
      [supplier.id, user_id]
    )

    if (existing) {
      // 取消合作
      req.db.run('DELETE FROM supplier_cooperations WHERE id = ?', [existing.id])
      res.json({ code: 200, data: { cooperated: false } })
    } else {
      // 标记合作
      const id = crypto.randomUUID()
      req.db.run(
        'INSERT INTO supplier_cooperations (id, supplier_id, user_id) VALUES (?, ?, ?)',
        [id, supplier.id, user_id]
      )
      res.json({ code: 200, data: { cooperated: true } })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
