import { Router } from 'express'
const router = Router()

// 标签接口
router.use('/tag_my_add', (await import('./tag_my_add.js')).default)   // POST /api/v1/tags/tag_my_add
router.use('/tag_my_get', (await import('./tag_my_get.js')).default)   // GET  /api/v1/tags/tag_my_get
router.use('/pool', (await import('./tag_pool.js')).default)           // GET  /api/v1/tags/pool
router.use('/', (await import('./tag_create.js')).default)             // POST   /api/v1/tags
router.use('/', (await import('./tag_delete.js')).default)             // DELETE /api/v1/tags/:id




export default router