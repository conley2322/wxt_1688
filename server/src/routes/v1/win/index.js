import { Router } from 'express'
const router = Router()

// 标签接口直接在此添加，如：
router.use('/get_product_my_tag', (await import('./product_get_my_tag.js')).default)// /api/v1/win/get_product_my_tag 获取我的标签




export default router