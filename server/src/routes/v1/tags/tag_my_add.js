import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
    console.log(req.body)
    try {
        const id = crypto.randomUUID()
        const result = req.db.run(
            'INSERT INTO tags (id, text, font_color, bg_color, visibility, creator, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, req.body.text, req.body.font_color, req.body.bg_color, req.body.visibility, req.body.creator, req.body.added_by]
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