import { Router } from 'express'
const router = Router({ mergeParams: true })

// POST /api/v1/products/:offer_id/tags
router.post('/', (req, res) => {
  try {
    const { offer_id } = req.params
    const { tag_id } = req.body
    const user_id = req.user.id

    if (!tag_id) {
      return res.status(400).json({ code: 400, message: '缺少 tag_id' })
    }

    // 检查标签是否存在
    const tag = req.db.get('SELECT id FROM tags WHERE id = ?', [tag_id])
    if (!tag) {
      return res.status(404).json({ code: 404, message: '标签不存在' })
    }

    // 检查是否已打
    const exists = req.db.get(
      'SELECT id FROM product_tags WHERE offer_id = ? AND tag_id = ? AND tag_user = ?',
      [offer_id, tag_id, user_id]
    )
    if (exists) {
      return res.status(400).json({ code: 400, message: '已打过该标签' })
    }

    const id = crypto.randomUUID()
    req.db.run(
      'INSERT INTO product_tags (id, offer_id, tag_id, tag_user) VALUES (?, ?, ?, ?)',
      [id, offer_id, tag_id, user_id]
    )

    const tagInfo = req.db.get('SELECT text FROM tags WHERE id = ?', [tag_id])
    const product = req.db.get('SELECT title FROM products WHERE offer_id = ?', [offer_id])
    req.logDetail = `${req.user.username} 给商品「${product?.title || offer_id}」添加了标签「${tagInfo?.text || tag_id}」`

    res.json({ code: 200, message: '标签已添加' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
