import { Router } from 'express'
const router = Router()

// POST /api/v1/products/batch_info
router.post('/', (req, res) => {
  try {
    const { offer_ids } = req.body
    const user_id = req.user.id
   //console.log(user_id)
   //console.log(offer_idßs)
    
    if (!offer_ids || !Array.isArray(offer_ids) || offer_ids.length === 0) {
      return res.status(400).json({ code: 400, message: '缺少 offer_ids' })
    }

    // 去重
    const uniqueIds = [...new Set(offer_ids)]

    // 真实查询计数：本接口每被真实调用一次（前端缓存未命中才会发起），
    // 按 (商品, 用户) 各 +1。独立统计表，商品未入库也计数；总次数与我的次数随其他数据一起返回。
    // prev_queried_at 沉降上一次查询时间：首次查询为空，之后每次查询把旧 last_queried_at 存入
    for (const id of uniqueIds) {
      req.db.run(
        `INSERT INTO product_query_stats (offer_id, user_id, query_count, last_queried_at)
         VALUES (?, ?, 1, datetime('now', 'localtime'))
         ON CONFLICT(offer_id, user_id) DO UPDATE SET
           query_count = query_count + 1,
           prev_queried_at = product_query_stats.last_queried_at,
           last_queried_at = datetime('now', 'localtime')`,
        [id, user_id]
      )
    }

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

    // 批量查被查询次数：总次数（全团队求和）+ 查询用户列表（头像栈，标记 is_me）
    // last_queried_at 输出为"应展示的查询时间"：商品只被查过 1 次 → 本次时间；查过多次 → 上一次时间
    //   （排除当前用户本次查询：当前用户取其 prev_queried_at，其他用户取各自最后查询时间，取最大）
    const queryTotals = req.db.query(
      `SELECT offer_id, SUM(query_count) AS count,
              CASE WHEN SUM(query_count) <= 1
                   THEN MAX(last_queried_at)
                   ELSE MAX(CASE WHEN user_id = ? THEN prev_queried_at ELSE last_queried_at END)
              END AS last_queried_at
       FROM product_query_stats
       WHERE offer_id IN (${placeholders}) GROUP BY offer_id`,
      [user_id, ...uniqueIds]
    )
    const queryUsers = req.db.query(
      `SELECT qs.offer_id, u.username, u.avatar_color, qs.query_count AS count, qs.last_queried_at
       FROM product_query_stats qs
       JOIN users u ON qs.user_id = u.id
       WHERE qs.offer_id IN (${placeholders})
       ORDER BY qs.offer_id, count DESC`,
      uniqueIds
    )

    // 批量查浏览用户
    const viewers = req.db.query(
      `SELECT v.offer_id, u.username, u.avatar_color, COUNT(*) AS count
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
      const qt = queryTotals.find(r => r.offer_id === id)
      const vs = viewers.filter(r => r.offer_id === id).map(v => ({
        username: v.username,
        initial: v.username.charAt(0),
        avatar_color: v.avatar_color || null,
        count: v.count
      }))
      // 查询用户列表（标记 is_me 供前端"仅我的次数"模式显示自己头像；last_queried_at 供时间轴展示）
      const qu = queryUsers.filter(r => r.offer_id === id).map(v => ({
        username: v.username,
        initial: v.username.charAt(0),
        avatar_color: v.avatar_color || null,
        count: v.count,
        last_queried_at: v.last_queried_at || null,
        is_me: v.username === req.user.username
      }))
      const mine = qu.find(u => u.is_me)

      result[id] = {
        view_count: vc ? vc.count : 0,
        comment_count: cc ? cc.count : 0,
        tag_count: tc ? tc.count : 0,
        query_count: qt ? (qt.count || 0) : 0,
        my_query_count: mine ? mine.count : 0,
        last_queried_at: qt ? qt.last_queried_at || null : null,
        query_users: qu,
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
