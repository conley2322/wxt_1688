import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
    // console.log('req.body', req.body.product_id)
    const id = crypto.randomUUID()

    try {
        req.db.run(
            'INSERT INTO product_comments (id, product_id, user_id, text,img) VALUES (?, ?, ?, ?, ?)',
            [id, req.body.product_id, req.body.user_id, req.body.text, req.body.img]
        )
        res.json({ message: '商品添加成功' })
    } catch (error) {
        console.log(error)
    }
})

export default router