import { Router } from 'express'
const router = Router()

// GET /api/v1/operations/logs — 获取操作日志（支持分页）
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.page_size) || 30
    const offset = (page - 1) * pageSize

    const logs = await req.db.query(`
      SELECT id, username, action, detail, created_at
      FROM operation_logs
      WHERE detail IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [pageSize, offset])

    const total = await req.db.get(`
      SELECT COUNT(*) AS count FROM operation_logs WHERE detail IS NOT NULL
    `)

    res.json({
      code: 200,
      data: logs,
      total: total?.count || 0,
      page,
      page_size: pageSize,
      message: '获取成功'
    })
  } catch (error) {
    res.status(500).json({ code: 500, message: '获取失败', error: error.message })
  }
})

export default router
