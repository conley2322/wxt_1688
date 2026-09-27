// v1 版本路由入口
import { Router } from 'express'

const router = Router()

router.use('/clients', (await import('./clients/index.js')).default)   // /api/v1/clients/**
router.use('/sync', (await import('./sync/index.js')).default)       // /api/v1/sync/**
router.use('/updates', (await import('./updates/index.js')).default) // /api/v1/updates/**

export default router
