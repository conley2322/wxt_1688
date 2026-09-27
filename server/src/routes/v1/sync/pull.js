// 拉取服务器数据：全部商品与笔记 + 近 N 天浏览/出现流水
import { Router } from 'express'

const router = Router()

// GET /api/v1/sync/pull?days=50
router.get('/', (req, res) => {
  const token = req.headers['x-client-token']
  if (!token) return res.status(401).json({ code: 401, message: '缺少客户端令牌' })

  const days = Math.min(parseInt(req.query.days) || 50, 365)
  const since = Date.now() - days * 86400000

  const data = {
    server_time: Date.now(),
    clients: req.db.query('SELECT token, nickname FROM clients'),
    products: req.db.query(
      'SELECT offer_id, title, main_img_url, supplier_name, updated_at FROM products'
    ),
    view_records: req.db.query(
      'SELECT offer_id, token, client_row_id, viewed_at FROM view_records WHERE viewed_at >= ?', since
    ),
    appear_records: req.db.query(
      'SELECT offer_id, token, client_row_id, appeared_at FROM appear_records WHERE appeared_at >= ?', since
    ),
    comments: req.db.query(
      'SELECT id, kind, target, token, nickname, text, created_at, updated_at FROM comments'
    ),
  }

  res.json({ code: 200, data })
})

export default router
