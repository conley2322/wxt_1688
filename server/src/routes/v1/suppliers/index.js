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

// 我的供应商列表（聚合评论+商品）
router.use('/my-suppliers', (await import('./my_suppliers.js')).default)                     // GET  /api/v1/suppliers/my-suppliers

// 供应商创建
router.use('/', (await import('./supplier_create.js')).default)                                          // POST /api/v1/suppliers

export default router
