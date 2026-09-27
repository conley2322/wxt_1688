// 最新版本查询（扩展启动时检查更新）
import { Router } from 'express'

const router = Router()

// GET /api/v1/updates/latest-version
router.get('/', (_req, res) => {
  res.json({ code: 200, data: { version: '0.4.0', url: '' } })
})

export default router
