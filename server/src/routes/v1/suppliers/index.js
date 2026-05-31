import { Router } from 'express'
const router = Router()

// 供应商评论
router.use('/comments', (await import('./supplier_comments/supplier_comment_list.js')).default)     // GET    /api/v1/suppliers/comments?supplier_name=xxx
router.use('/comments', (await import('./supplier_comments/supplier_comment_add.js')).default)      // POST   /api/v1/suppliers/comments
router.use('/comments', (await import('./supplier_comments/supplier_comment_update.js')).default)   // PUT    /api/v1/suppliers/comments/:id
router.use('/comments', (await import('./supplier_comments/supplier_comment_delete.js')).default)   // DELETE /api/v1/suppliers/comments/:id

// 供应商标签
router.use('/tags', (await import('./supplier_tags/supplier_tag_list.js')).default)                 // GET    /api/v1/suppliers/tags?supplier_name=xxx
router.use('/tags', (await import('./supplier_tags/supplier_tag_add.js')).default)                  // POST   /api/v1/suppliers/tags
router.use('/tags', (await import('./supplier_tags/supplier_tag_remove.js')).default)               // DELETE /api/v1/suppliers/tags/:tag_id?supplier_name=xxx

// 供应商创建
router.use('/', (await import('./supplier_create.js')).default)                                          // POST /api/v1/suppliers

// 供应商合作
router.use('/cooperate', (await import('./supplier_cooperate/supplier_cooperate_toggle.js')).default)  // POST /api/v1/suppliers/cooperate
router.use('/cooperate', (await import('./supplier_cooperate/supplier_cooperate_status.js')).default)  // GET  /api/v1/suppliers/cooperate/status

export default router
