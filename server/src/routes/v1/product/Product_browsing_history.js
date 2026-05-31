import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
  try {
    const { offer_id, title, main_img_url, supplier_name } = req.body
    const id = crypto.randomUUID()

    // 1. 写浏览记录
    req.db.run(
      'INSERT INTO view_records (id, offer_id, user_id) VALUES (?, ?, ?)',
      [id, offer_id, req.user.id]
    )

    // 2. 检查商品
    const product = req.db.get('SELECT * FROM products WHERE offer_id = ?', [offer_id])

    if (!product) {
      // 不存在 → 创建
      req.db.run(
        'INSERT INTO products (offer_id, title, main_img_url, supplier_name, created_by) VALUES (?, ?, ?, ?, ?)',
        [offer_id, title || null, main_img_url || null, supplier_name ? supplier_name.trim() : null, req.user.id]
      )
    } else {
      // 存在 → 补充空字段（每次浏览都可能获取到新数据）
      if (!product.main_img_url && main_img_url) {
        req.db.run('UPDATE products SET main_img_url = ? WHERE offer_id = ?', [main_img_url, offer_id])
      }
      if (!product.title && title) {
        req.db.run('UPDATE products SET title = ? WHERE offer_id = ?', [title, offer_id])
      }
      if (!product.supplier_name && supplier_name) {
        req.db.run('UPDATE products SET supplier_name = ? WHERE offer_id = ?', [supplier_name.trim(), offer_id])
      }
    }

    // 3. 查询浏览用户统计
    const viewers = req.db.query(
      `SELECT u.username, COUNT(*) AS count
       FROM view_records v
       JOIN users u ON v.user_id = u.id
       WHERE v.offer_id = ?
       GROUP BY v.user_id
       ORDER BY count DESC`,
      [offer_id]
    )

    res.json({
      code: 200,
      message: '浏览记录添加成功',
      id,
      data: {
        view_count: viewers.reduce((sum, v) => sum + v.count, 0),
        viewers: viewers.map(v => ({
          username: v.username,
          initial: v.username.charAt(0),
          count: v.count
        }))
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router