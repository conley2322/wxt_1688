import { Router } from 'express'
const router = Router()

// POST /api/v1/products
// 不存在则创建，已存在则补充空字段（title / main_img_url / supplier_name）
router.post('/', (req, res) => {
  try {
    const { offer_id, title, main_img_url, supplier_name } = req.body

    if (!offer_id) {
      return res.status(400).json({ code: 400, message: '缺少 offer_id' })
    }

    const existing = req.db.get('SELECT * FROM products WHERE offer_id = ?', [offer_id])

    if (existing) {
      // 已存在：补充空字段
      const updates = []
      const params = []
      if (!existing.title && title) { updates.push('title = ?'); params.push(title) }
      if (!existing.main_img_url && main_img_url) { updates.push('main_img_url = ?'); params.push(main_img_url) }
      if (!existing.supplier_name && supplier_name) { updates.push('supplier_name = ?'); params.push(supplier_name.trim()) }
      if (updates.length > 0) {
        params.push(offer_id)
        req.db.run(`UPDATE products SET ${updates.join(', ')} WHERE offer_id = ?`, params)
      }
      return res.json({ code: 200, message: '商品已存在', updated: updates.length > 0 })
    }

    // 创建新商品
    req.db.run(
      'INSERT INTO products (offer_id, title, main_img_url, supplier_name) VALUES (?, ?, ?, ?)',
      [offer_id, title || null, main_img_url || null, supplier_name ? supplier_name.trim() : null]
    )

    res.json({ code: 200, message: '商品已入库' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
