// sync 模块入口
import { Router } from 'express'

const router = Router()

router.use('/push', (await import('./push.js')).default) // POST /api/v1/sync/push
router.use('/pull', (await import('./pull.js')).default) // GET  /api/v1/sync/pull

export default router
