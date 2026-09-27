// 批量推送：商品 / 浏览流水 / 出现流水 / 笔记（一个事务，全部幂等可重放）
import { Router } from 'express'

const router = Router()
const DAY = 86400000

// POST /api/v1/sync/push
router.post('/', (req, res) => {
  const token = req.headers['x-client-token'] || req.body?.token
  if (!token) return res.status(401).json({ code: 401, message: '缺少客户端令牌' })
  const client = req.db.get('SELECT token FROM clients WHERE token = ?', token)
  if (!client) return res.status(401).json({ code: 401, message: '客户端未注册，请先连接注册' })

  const { products = [], view_records = [], appear_records = [], comments = [] } = req.body

  const counts = req.rawDb.transaction(() => {
    let product_n = 0, view_n = 0, appear_n = 0, comment_n = 0

    // 商品 upsert：空字符串不覆盖已有值
    const productStmt = req.rawDb.prepare(`
      INSERT INTO products (offer_id, title, main_img_url, supplier_name, updated_at)
      VALUES (@offer_id, @title, @main_img_url, @supplier_name, @updated_at)
      ON CONFLICT(offer_id) DO UPDATE SET
        title         = COALESCE(NULLIF(excluded.title, ''), products.title),
        main_img_url  = COALESCE(NULLIF(excluded.main_img_url, ''), products.main_img_url),
        supplier_name = COALESCE(NULLIF(excluded.supplier_name, ''), products.supplier_name),
        updated_at    = excluded.updated_at
    `)
    for (const p of products) {
      productStmt.run({
        offer_id: String(p.offer_id),
        title: p.title || '',
        main_img_url: p.main_img_url || '',
        supplier_name: p.supplier_name || '',
        updated_at: Date.now(),
      })
      product_n++
    }

    // 浏览流水：(token, client_row_id) 唯一，重推自动忽略
    const viewStmt = req.rawDb.prepare(
      'INSERT OR IGNORE INTO view_records (offer_id, token, client_row_id, viewed_at) VALUES (?, ?, ?, ?)'
    )
    for (const r of view_records) {
      view_n += viewStmt.run(String(r.offer_id), token, Number(r.client_row_id), Number(r.viewed_at)).changes
    }

    // 出现流水
    const appearStmt = req.rawDb.prepare(
      'INSERT OR IGNORE INTO appear_records (offer_id, token, client_row_id, appeared_at) VALUES (?, ?, ?, ?)'
    )
    for (const r of appear_records) {
      appear_n += appearStmt.run(String(r.offer_id), token, Number(r.client_row_id), Number(r.appeared_at)).changes
    }

    // 笔记 upsert（UUID 主键）
    const commentStmt = req.rawDb.prepare(`
      INSERT INTO comments (id, kind, target, token, nickname, text, created_at, updated_at)
      VALUES (@id, @kind, @target, @token, @nickname, @text, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        nickname   = excluded.nickname,
        text       = excluded.text,
        updated_at = excluded.updated_at
    `)
    for (const c of comments) {
      commentStmt.run({
        id: String(c.id),
        kind: String(c.kind),
        target: String(c.target),
        token,
        nickname: c.nickname || '',
        text: c.text || '',
        created_at: Number(c.created_at),
        updated_at: c.updated_at ? Number(c.updated_at) : null,
      })
      comment_n++
    }

    return { products: product_n, view_records: view_n, appear_records: appear_n, comments: comment_n }
  })()

  res.json({ code: 200, data: counts, message: '同步成功' })
})

export default router
