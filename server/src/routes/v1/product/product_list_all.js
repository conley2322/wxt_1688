import { Router } from 'express'
const router = Router()

// GET /api/v1/products
router.get('/', (req, res) => {
  try {
    const products = req.db.query(
      `SELECT offer_id, title, main_img_url, supplier_name, created_by, created_at
       FROM products
       ORDER BY created_at DESC
       LIMIT 100`
    )
    res.json({ code: 200, data: products })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
