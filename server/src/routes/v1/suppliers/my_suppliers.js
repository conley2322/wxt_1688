import { Router } from 'express'
const router = Router()

// GET /api/v1/suppliers/my-suppliers
// 返回当前用户看过商品或留言过的供应商列表，聚合评论和商品
router.get('/', (req, res) => {
  try {
    const userId = req.user.id

    // 1. 查找用户关联的所有供应商
    //    - 看过商品 → view_records + products
    //    - 留言过 → supplier_comments + suppliers
    const suppliers = req.db.query(`
      SELECT DISTINCT 
        COALESCE(p.supplier_name, s.name) AS name
      FROM view_records v
      LEFT JOIN products p ON v.offer_id = p.offer_id
      LEFT JOIN suppliers s ON p.supplier_name = s.name
      WHERE v.user_id = ? AND (p.supplier_name IS NOT NULL OR s.name IS NOT NULL)

      UNION

      SELECT DISTINCT s.name
      FROM supplier_comments sc
      JOIN suppliers s ON sc.supplier_id = s.id
      WHERE sc.user_id = ?
    `, [userId, userId])

    if (suppliers.length === 0) {
      return res.json({ code: 200, data: [], message: '暂无关联供应商' })
    }

    // 2. 对每个供应商，查评论和商品
    const result = suppliers.map(row => {
      const name = row.name

      // 当前用户对该供应商的评论
      const comments = req.db.query(`
        SELECT sc.id, sc.text, sc.created_at, sc.updated_at
        FROM supplier_comments sc
        JOIN suppliers s ON sc.supplier_id = s.id
        WHERE s.name = ? AND sc.user_id = ?
        ORDER BY sc.created_at DESC
      `, [name, userId])

      // 当前用户浏览过的该供应商商品
      const products = req.db.query(`
        SELECT DISTINCT p.offer_id, p.title, p.main_img_url
        FROM view_records v
        JOIN products p ON v.offer_id = p.offer_id
        WHERE p.supplier_name = ? AND v.user_id = ?
        ORDER BY v.viewed_at DESC
        LIMIT 20
      `, [name, userId])

      return {
        supplier_name: name,
        comments,
        products,
        comment_count: comments.length,
        product_count: products.length,
      }
    })

    // 按最近活跃排序（有评论优先，商品数量多的优先）
    result.sort((a, b) => {
      if (a.comment_count > 0 && b.comment_count === 0) return -1
      if (b.comment_count > 0 && a.comment_count === 0) return 1
      return b.product_count - a.product_count
    })

    res.json({
      code: 200,
      data: result,
      message: '获取成功'
    })
  } catch (error) {
    console.error('[my-suppliers] 错误:', error)
    res.status(500).json({
      code: 500,
      message: '获取供应商列表失败',
      error: error.message
    })
  }
})

export default router
