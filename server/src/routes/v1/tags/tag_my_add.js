import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
    console.log(req.body)
    try {
        const id = crypto.randomUUID()
        const result = req.db.run(
            'INSERT INTO tags (id, text, color, bgcolor, visible, created_user_id) VALUES (?, ?, ?, ?, ?, ?)',
            [id, req.body.text, req.body.color, req.body.bgcolor, req.body.visible, req.body.created_user_id]
        )
        res.json({ message: '标签添加成功', id: id })
        if (result.changes === 0) {
            res.status(400).json({ message: '标签添加失败' })
        }
    } catch (error) {
        console.log(error)
    }

})

export default router