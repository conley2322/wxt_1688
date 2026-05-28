import { Router } from 'express'
const router = Router()

// 标签接口直接在此添加，如：
router.use('/tag_my_add', (await import('./tag_my_add.js')).default)// /api/v1/tags/tag_my_add 添加我的标签
router.use('/tag_my_get', (await import('./tag_my_get.js')).default)// /api/v1/tags/tag_my_get 获取我的标签




export default router