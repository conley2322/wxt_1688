import { Router } from 'express'
const router = Router()

router.use('/Product_browsing_history', (await import('./Product_browsing_history.js')).default)  // /api/v1/products/Product_browsing_history

export default router