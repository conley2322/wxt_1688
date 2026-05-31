import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
    console.log(req.query.user_id)
    try {
        const result = req.db.query
        (
            'SELECT * FROM tags WHERE added_by = ?',
            [req.query.user_id]
        )
        res.json({ message: '标签获取成功', tags: result })
        if (result.length === 0) {
            res.status(400).json({ message: '标签获取失败' })
        }
    } catch (error) {
        console.log(error)
    }

})

export default router