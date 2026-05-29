
import { Router } from 'express'
const router = Router()

router.get('/', (req, res) => {
    console.log(req.query.offer_id)
    try {
        const offerId = req.query.offer_id

        const product = req.db.get(// 商品信息
            'SELECT * FROM products WHERE offer_id = ?',
            [offerId]
        )
        console.log(product)
        const result = req.db.get(// 商品评论
            'SELECT offer_id, user_id, text, img FROM product_comments WHERE offer_id = ?',
            [offerId]
        )

        const textCount = req.db.get(// 评论数量
            `SELECT COUNT(*) AS count
                  FROM product_comments
                WHERE offer_id = ?`,
            [offerId]
        )
        const viewCount = req.db.get(// 浏览记录数量
            `SELECT COUNT(*) AS count
                  FROM view_records
                WHERE offer_id = ?`,
            [offerId]
        )
        const tags = req.db.get(// 商品标签 标签数量
            `SELECT COUNT(*) AS count
                  FROM tags
             JOIN product_tags ON tags.id = product_tags.tag_id
             WHERE product_tags.offer_id = ?`,
            [offerId]
        )
        console.log(tags.count)

        res.json({
            message: '根据商品id获取到的我的商品信息',
            result: result,
            viewCount: viewCount.count,// 浏览记录数量
            textCount: textCount.count,// 评论数量
            tagsCount: tags.count,// 商品标签数量
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: '报错了' })
    }
})

export default router