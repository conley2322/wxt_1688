import { Router } from 'express'
const router = Router()

// GET /api/v1/products/mine — 当前用户浏览过的商品，支持搜索和排序
router.get('/', (req, res) => {
  try {
    const user_id = req.user.id
    const { search, search_type, tag_id, sort_by, sort_order } = req.query
    console.log('[product_mine] 用户:', user_id, '搜索:', search, search_type, '标签:', tag_id, '排序:', sort_by, sort_order)

    // 1. 获取当前用户浏览过的所有 offer_id
    let offerIds = req.db.query(
      `SELECT DISTINCT offer_id FROM view_records WHERE user_id = ? ORDER BY offer_id DESC LIMIT 500`,
      [user_id]
    )

    if (offerIds.length === 0) {
      return res.json({ code: 200, data: [], total: 0 })
    }

    // 2. 按标签筛选
    if (tag_id) {
      const taggedOffers = req.db.query(
        `SELECT DISTINCT offer_id FROM product_tags WHERE tag_id = ? AND tag_user = ?`,
        [tag_id, user_id]
      )
      const taggedSet = new Set(taggedOffers.map(r => r.offer_id))
      offerIds = offerIds.filter(r => taggedSet.has(r.offer_id))
    }

    if (offerIds.length === 0) {
      return res.json({ code: 200, data: [], total: 0 })
    }

    const placeholders = offerIds.map(() => '?').join(',')
    const ids = offerIds.map(r => r.offer_id)

    // 3. 获取商品基础信息
    let products = req.db.query(
      `SELECT offer_id, title, main_img_url, supplier_name, created_at
       FROM products WHERE offer_id IN (${placeholders})`,
      ids
    )

    // 4. 按评论内容搜索
    if (search && search_type === 'comment') {
      const matchedOffers = req.db.query(
        `SELECT DISTINCT offer_id FROM product_comments
         WHERE offer_id IN (${placeholders}) AND text LIKE ?`,
        [...ids, `%${search}%`]
      )
      const matchedSet = new Set(matchedOffers.map(r => r.offer_id))
      products = products.filter(p => matchedSet.has(p.offer_id))
    }

    // 5. 按标题搜索
    if (search && search_type === 'title') {
      products = products.filter(p => p.title && p.title.includes(search))
    }

    // 6. 为每个商品附加详情
    let result = products.map(p => {
      const tags = req.db.query(
        `SELECT t.id, t.text, t.font_color, t.bg_color
         FROM product_tags pt JOIN tags t ON pt.tag_id = t.id
         WHERE pt.offer_id = ? AND pt.tag_user = ?`,
        [p.offer_id, user_id]
      )
      const myComment = req.db.get(
        'SELECT text FROM product_comments WHERE offer_id = ? AND user_id = ? LIMIT 1',
        [p.offer_id, user_id]
      )
      const commentCount = req.db.get(
        'SELECT COUNT(*) AS count FROM product_comments WHERE offer_id = ?',
        [p.offer_id]
      )
      const viewCount = req.db.get(
        'SELECT COUNT(*) AS count FROM view_records WHERE offer_id = ?',
        [p.offer_id]
      )
      return {
        ...p,
        tags,
        my_comment: myComment?.text || null,
        comment_count: commentCount?.count || 0,
        view_count: viewCount?.count || 0
      }
    })

    // 7. 排序
    if (sort_by === 'view_count') {
      result.sort((a, b) => sort_order === 'asc' ? a.view_count - b.view_count : b.view_count - a.view_count)
    } else if (sort_by === 'comment_count') {
      result.sort((a, b) => sort_order === 'asc' ? a.comment_count - b.comment_count : b.comment_count - a.comment_count)
    } else {
      // 默认按浏览时间降序（最近浏览的在前）
      result.sort((a, b) => sort_order === 'asc' ? 0 : -1) // 保持原始顺序(按offer_id DESC)
    }

    console.log('[product_mine] 返回', result.length, '个商品')
    res.json({ code: 200, data: result, total: result.length })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
