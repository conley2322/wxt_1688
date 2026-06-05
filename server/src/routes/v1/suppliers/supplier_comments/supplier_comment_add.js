import { Router } from 'express'
const router = Router()

// POST /api/v1/suppliers/comments
router.post('/', (req, res) => {
  try {
    const { supplier_name, text } = req.body
    const user_id = req.user.id

    if (!supplier_name) {
      return res.status(400).json({ code: 400, message: '缺少 supplier_name' })
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ code: 400, message: '评论内容不能为空' })
    }

    // 供应商不存在则自动创建
    let supplier = req.db.get('SELECT id FROM suppliers WHERE name = ?', [supplier_name.trim()])
    if (!supplier) {
      const supplierId = crypto.randomUUID()
      req.db.run(
        'INSERT INTO suppliers (id, name) VALUES (?, ?)',
        [supplierId, supplier_name.trim()]
      )
      supplier = { id: supplierId }
    }

    const id = crypto.randomUUID()
    req.db.run(
      'INSERT INTO supplier_comments (id, supplier_id, user_id, text) VALUES (?, ?, ?, ?)',
      [id, supplier.id, user_id, text.trim()]
    )

    // 告诉 logger 中间件用可读描述
    req.logDetail = `${req.user.username} 给供应商「${supplier_name.trim()}」添加了一条评论`

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
