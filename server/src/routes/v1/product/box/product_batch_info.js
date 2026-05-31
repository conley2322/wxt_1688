import { Router } from 'express'
const router = Router()

// POST /api/v1/products/batch_info
router.post('/', (req, res) => {
  try {
    const { offer_ids } = req.body
    const user_id = req.user.id
    console.log(user_id)
    console.log(offer_ids)
    
    if (!offer_ids || !Array.isArray(offer_ids) || offer_ids.length === 0) {
      return res.status(400).json({ code: 400, message: '缺少 offer_ids' })
    }

    // 去重
    const uniqueIds = [...new Set(offer_ids)]

    // 批量查浏览统计
    const placeholders = uniqueIds.map(() => '?').join(',')
    const viewCounts = req.db.query(
      `SELECT offer_id, COUNT(*) AS count FROM view_records WHERE offer_id IN (${placeholders}) GROUP BY offer_id`,
      uniqueIds
    )

    // 批量查评论统计
    const commentCounts = req.db.query(
      `SELECT offer_id, COUNT(*) AS count FROM product_comments WHERE offer_id IN (${placeholders}) GROUP BY offer_id`,
      uniqueIds
    )

    // 批量查标签统计
    const tagCounts = req.db.query(
      `SELECT offer_id, COUNT(*) AS count FROM product_tags WHERE offer_id IN (${placeholders}) GROUP BY offer_id`,
      uniqueIds
    )

    // 批量查浏览用户
    const viewers = req.db.query(
      `SELECT v.offer_id, u.username, COUNT(*) AS count
       FROM view_records v
       JOIN users u ON v.user_id = u.id
       WHERE v.offer_id IN (${placeholders})
       GROUP BY v.offer_id, v.user_id
       ORDER BY v.offer_id, count DESC`,
      uniqueIds
    )

    // 当前用户是否浏览过
    const myViews = req.db.query(
      `SELECT offer_id FROM view_records WHERE offer_id IN (${placeholders}) AND user_id = ?`,
      [...uniqueIds, user_id]
    )
    const myViewSet = new Set(myViews.map(r => r.offer_id))

    // 组装结果
    const result = {}
    for (const id of uniqueIds) {
      const vc = viewCounts.find(r => r.offer_id === id)
      const cc = commentCounts.find(r => r.offer_id === id)
      const tc = tagCounts.find(r => r.offer_id === id)
      const vs = viewers.filter(r => r.offer_id === id).map(v => ({
        username: v.username,
        initial: v.username.charAt(0),
        count: v.count
      }))

      result[id] = {
        view_count: vc ? vc.count : 0,
        comment_count: cc ? cc.count : 0,
        tag_count: tc ? tc.count : 0,
        viewers: vs,
        i_have_viewed: myViewSet.has(id)
      }
    }

    res.json({ code: 200, data: result })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
