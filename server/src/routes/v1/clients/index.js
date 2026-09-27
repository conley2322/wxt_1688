// clients 模块入口
import { Router } from 'express'

const router = Router()

router.use('/', (await import('./register.js')).default) // POST /api/v1/clients

export default router
