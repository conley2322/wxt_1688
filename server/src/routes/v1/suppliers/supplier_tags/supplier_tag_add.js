import { Router } from 'express'
const router = Router()

// POST /api/v1/suppliers/tags
router.post('/', (req, res) => {
  try {
    const { supplier_name, tag_id } = req.body
    const user_id = req.user.id

    if (!supplier_name) {
      return res.status(400).json({ code: 400, message: '缺少 supplier_name' })
    }
    if (!tag_id) {
      return res.status(400).json({ code: 400, message: '缺少 tag_id' })
    }

    // 获取供应商
    let supplier = req.db.get('SELECT id FROM suppliers WHERE name = ?', [supplier_name.trim()])
    if (!supplier) {
      return res.status(404).json({ code: 404, message: '供应商不存在，请先发表评论' })
    }

    // 检查标签是否存在
    const tag = req.db.get('SELECT id FROM tags WHERE id = ?', [tag_id])
    if (!tag) {
      return res.status(404).json({ code: 404, message: '标签不存在' })
    }

    // 检查是否已打
    const exists = req.db.get(
      'SELECT id FROM supplier_tags WHERE supplier_id = ? AND tag_id = ? AND tag_user = ?',
      [supplier.id, tag_id, user_id]
    )
    if (exists) {
      return res.status(400).json({ code: 400, message: '已打过该标签' })
    }

    const id = crypto.randomUUID()
    req.db.run(
      'INSERT INTO supplier_tags (id, supplier_id, tag_id, tag_user) VALUES (?, ?, ?, ?)',
      [id, supplier.id, tag_id, user_id]
    )

    res.json({ code: 200, message: '标签已添加' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
