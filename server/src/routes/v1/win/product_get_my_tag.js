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

        //其他人标签
        const otherTags = req.db.query
            (
                'SELECT tags.text, tags.font_color, tags.bg_color, tags.visibility, product_tags.assigned_at FROM product_tags LEFT JOIN tags ON product_tags.tag_id = tags.id WHERE offer_id = ? and visibility = 1',
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