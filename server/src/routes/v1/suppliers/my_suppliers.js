import { Router } from 'express'
const router = Router()

// GET /api/v1/suppliers/my-suppliers
// 返回当前用户看过商品或留言过的供应商列表（分页）
// 查询参数：page / page_size / search（供应商名称）/ filter（all|commented|viewed）
// 响应：{ code, data, total, page, page_size, stats: { total, commented, totalProducts } }
router.get('/', (req, res) => {
  try {
    const userId = req.user.id
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.page_size) || 10
    const offset = (page - 1) * pageSize
    const search = (req.query.search || '').trim().toLowerCase()
    const filter = req.query.filter || 'all'

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

    // 2. 两条 GROUP BY 一次性查出每个供应商的评论数 / 浏览商品数（避免逐个供应商查明细）
    const commentCountRows = req.db.query(`
      SELECT s.name, COUNT(*) AS c
      FROM supplier_comments sc
      JOIN suppliers s ON sc.supplier_id = s.id
      WHERE sc.user_id = ?
      GROUP BY s.name
    `, [userId])
    const commentCountMap = new Map(commentCountRows.map(r => [r.name, r.c]))

    const productCountRows = req.db.query(`
      SELECT p.supplier_name AS name, COUNT(DISTINCT p.offer_id) AS c
      FROM view_records v
      JOIN products p ON v.offer_id = p.offer_id
      WHERE v.user_id = ? AND p.supplier_name IS NOT NULL
      GROUP BY p.supplier_name
    `, [userId])
    const productCountMap = new Map(productCountRows.map(r => [r.name, r.c]))

    // 3. 合并基础信息
    let list = suppliers.map(row => ({
      supplier_name: row.name,
      comment_count: commentCountMap.get(row.name) || 0,
      product_count: productCountMap.get(row.name) || 0,
    }))

    // 页头统计（不受筛选/搜索影响）
    const stats = {
      total: list.length,
      commented: list.filter(s => s.comment_count > 0).length,
      totalProducts: list.reduce((sum, s) => sum + s.product_count, 0),
    }

    // 4. 按类型筛选
    if (filter === 'commented') {
      list = list.filter(s => s.comment_count > 0)
    } else if (filter === 'viewed') {
      list = list.filter(s => s.comment_count === 0)
    }

    // 5. 按名称搜索
    if (search) {
      list = list.filter(s => s.supplier_name.toLowerCase().includes(search))
    }

    // 6. 按最近活跃排序（有评论优先，商品数量多的优先）
    list.sort((a, b) => {
      if (a.comment_count > 0 && b.comment_count === 0) return -1
      if (b.comment_count > 0 && a.comment_count === 0) return 1
      return b.product_count - a.product_count
    })

    // 7. 分页
    const total = list.length
    const pageList = list.slice(offset, offset + pageSize)

    // 8. 只为当前页的供应商拉取评论明细和商品明细
    const result = pageList.map(item => {
      const name = item.supplier_name

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

      return { ...item, comments, products }
    })

    res.json({
      code: 200,
      data: result,
      total,
      page,
      page_size: pageSize,
      stats,
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
