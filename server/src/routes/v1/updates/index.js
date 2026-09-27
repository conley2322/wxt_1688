// updates 模块入口
import { Router } from 'express'

const router = Router()

router.use('/latest-version', (await import('./latest-version.js')).default) // GET /api/v1/updates/latest-version

export default router
