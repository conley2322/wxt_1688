import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
    // console.log('req.body', req.body.product_id)
    const id = crypto.randomUUID()

    try {
        const result = req.db.run(
            'INSERT INTO product_comments (id, offer_id, user_id, text,img) VALUES (?, ?, ?, ?, ?)',
            [id, req.body.offer_id, req.body.user_id, req.body.text, req.body.img]
        )
        if (result.changes === 1) {
            res.json({ message: '商品添加成功', id: id })
        } else {
            res.status(500).json({ error: '报错了' })
        }
    } catch (error) {
        console.log(error)
    }
})

export default router