
import { Router } from 'express'
const router = Router()

router.get('/', (req, res) => {
    console.log(req.query.product_id)
    try {

        const product = req.db.get(// 商品信息
            'SELECT * FROM products WHERE id = ?',
            [req.query.product_id]
        )
        console.log(product)
        const result = req.db.get(// 商品评论
            'SELECT product_id, user_id, text, img FROM product_comments WHERE product_id = ?',
            [req.query.product_id]
        )

        const textCount = req.db.get(// 评论数量
            `SELECT COUNT(*) AS count
                  FROM product_comments
                WHERE product_id = ?`,
            [req.query.product_id]
        )
        const viewCount = req.db.get(// 浏览记录数量
            `SELECT COUNT(*) AS count
                  FROM view_records
                WHERE product_id = ?`,
            [req.query.product_id]
        )
        const tags = req.db.get(// 商品标签 标签数量
            `SELECT COUNT(*) AS count
                  FROM tags
             JOIN product_tags ON tags.id = product_tags.tag_id
             WHERE product_tags.product_id = ?`,
            [req.query.product_id]
        )
        console.log(tags.count)

        res.json({
            message: '根据商品id获取到的我的商品信息',
            result: result,
            viewCount: viewCount.count,
            textCount: textCount.count,
            tagsCount: tags.count
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: '报错了' })
    }
})

export default router