import { Router } from 'express'
const router = Router()

router.use('/Product_browsing_history', (await import('./Product_browsing_history.js')).default)  // /api/v1/products/Product_browsing_history,上传浏览记录信息，每次访问商品时调用
router.use('/Product_list', (await import('./Product_list.js')).default)  // /api/v1/products/Product_list,上传商品信息
router.use('/Product_get_box_info', (await import('./box/Product_get_box_info.js')).default)  // /api/v1/products/Product_get_box_info,获取我的商品信息

// 商品评论
router.use('/:offer_id/comments', (await import('./product_comments/product_comment_list.js')).default)    // GET    /api/v1/products/:offer_id/comments
router.use('/:offer_id/comments', (await import('./product_comments/product_comment_add.js')).default)     // POST   /api/v1/products/:offer_id/comments
router.use('/comments', (await import('./product_comments/product_comment_update.js')).default)            // PUT    /api/v1/products/comments/:id
router.use('/comments', (await import('./product_comments/product_comment_delete.js')).default)            // DELETE /api/v1/products/comments/:id

// 商品标签
router.use('/:offer_id/tags', (await import('./product_tags/product_tag_list.js')).default)              // GET    /api/v1/products/:offer_id/tags
router.use('/:offer_id/tags', (await import('./product_tags/product_tag_add.js')).default)               // POST   /api/v1/products/:offer_id/tags
router.use('/:offer_id/tags', (await import('./product_tags/product_tag_remove.js')).default)            // DELETE /api/v1/products/:offer_id/tags/:tag_id

// Box批量 + 商品入库
router.use('/batch_info', (await import('./box/product_batch_info.js')).default)                        // POST   /api/v1/products/batch_info
router.use('/', (await import('./product_create.js')).default)                                         // POST   /api/v1/products

export default router