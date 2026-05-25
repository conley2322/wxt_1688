import express from 'express'

const router = express.Router()

// 所有接口统一加载，每个模块的子路由在各自 index.js 中注册

router.use('/users', (await import('./users/index.js')).default)       // /api/v1/users/**
router.use('/products', (await import('./product/index.js')).default)   // /api/v1/products/**
router.use('/tags', (await import('./tags/index.js')).default)          // /api/v1/tags/**

export default router