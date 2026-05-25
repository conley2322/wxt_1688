import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
    try {
        const id = crypto.randomUUID()
        console.log(req.body.product_id, req.body.user_id)

        const result = req.db.run(
            'INSERT INTO view_records (id, product_id, user_id) VALUES (?, ?, ?)',
            [id, req.body.product_id, req.body.user_id]
        )
        console.log(result)
        res.json({ message: '浏览记录添加成功' })
    } catch (error) {
        res.status(500).json({ error: '报错了' })
    }
})

export default router