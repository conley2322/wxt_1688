// 路由总入口：挂载各版本路由
import { Router } from 'express'

const router = Router()

router.use('/api/v1', (await import('./v1/index.js')).default) // /api/v1/**

export default router
