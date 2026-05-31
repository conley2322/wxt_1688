import express from 'express'

const router = express.Router()
//中间件 需要控制登入token，有才能访问
import { authenticate } from '../../middlewares/auth/index.js'

// 所有接口统一加载，每个模块的子路由在各自 index.js 中注册

router.use('/users', (await import('./users/index.js')).default)       // /api/v1/users/**
router.use('/products', authenticate, (await import('./product/index.js')).default)   // /api/v1/products/**
router.use('/tags', authenticate, (await import('./tags/index.js')).default)          // /api/v1/tags/**
router.use('/win', authenticate, (await import('./win/index.js')).default)            // /api/v1/win/**
router.use('/suppliers', authenticate, (await import('./suppliers/index.js')).default) // /api/v1/suppliers/**
router.use('/upload', authenticate, (await import('./upload/index.js')).default)         // /api/v1/upload/**
export default router