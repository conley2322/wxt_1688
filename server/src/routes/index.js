import express from 'express'
import v1Router from './v1/index.js'

const router = express.Router()

// 挂载各版本路由
router.use('/v1', v1Router) // v1版本：基础用户模块、测试接口

export default router
