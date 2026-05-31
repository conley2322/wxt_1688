import { Router } from 'express'
const router = Router()

router.get('/', (req, res) => {
    console.log(req.query.offer_id)
    try {
        const myTags = req.db.query
            (
                'SELECT tags.text, tags.font_color, tags.bg_color, tags.visibility, product_tags.assigned_at FROM product_tags LEFT JOIN tags ON product_tags.tag_id = tags.id WHERE tag_user = ? and offer_id = ? ',
                [req.user.id, req.query.offer_id]
            )

        //其他人标签（只显示 public 标签）
        const otherTags = req.db.query
            (
                `SELECT t.text, t.font_color, t.bg_color, t.visibility, pt.assigned_at, u.username AS creator
                 FROM product_tags pt
                 LEFT JOIN tags t ON pt.tag_id = t.id
                 LEFT JOIN users u ON pt.tag_user = u.id
                 WHERE pt.offer_id = ? AND t.visibility = 'public'`,
                [req.query.offer_id]
            )
        console.log(otherTags)

        if (myTags.length === 0 && otherTags.length === 0) {
            res.status(400).json({ message: '标签获取失败' })
            return
        }

        res.json({
            message: '标签获取成功', tags: {
                myTags,
                otherTags
            }
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: '服务器错误' })
    }

})

export default router