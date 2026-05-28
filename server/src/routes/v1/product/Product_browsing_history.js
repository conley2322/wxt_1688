import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
    console.log(req.body)
    try {
        const id = crypto.randomUUID()
        const result = req.db.run(
            'INSERT INTO view_records (id, product_id, user_id) VALUES (?, ?, ?)',
            [id, req.body.product_id, req.user_id]
        )
        console.log(result)
        if (result.changes === 1) {
            res.json({ message: '浏览记录添加成功', id: id })
        } else {
            res.status(500).json({ error: '报错了' })
        }
    } catch (error) {
        res.status(500).json({ error: '报错了' })
    }
})

export default router