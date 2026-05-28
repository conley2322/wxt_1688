import { Router } from 'express'
const router = Router()

router.use('/Product_browsing_history', (await import('./Product_browsing_history.js')).default)  // /api/v1/products/Product_browsing_history,上传浏览记录信息，每次访问商品时调用
router.use('/Product_list', (await import('./Product_list.js')).default)  // /api/v1/products/Product_list,上传商品信息
router.use('/Product_get_info', (await import('./Product_get_info.js')).default)  // /api/v1/products/Product_get_info,获取我的商品信息

export default router