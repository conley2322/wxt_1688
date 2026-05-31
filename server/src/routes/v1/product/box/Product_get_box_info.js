
import { Router } from 'express'
const router = Router()

router.get('/', (req, res) => {
    console.log(req.query.offer_id)
    try {
        const offerId = req.query.offer_id


        const result = req.db.get(// 商品评论
            'SELECT    created_at, text, img FROM product_comments WHERE offer_id = ?',
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

        const viewCountByUser = req.db.query(// 每个用户的浏览次数
            `SELECT   u.username, COUNT(v.user_id) AS view_count
            FROM view_records v
            JOIN users u ON v.user_id = u.id
            WHERE v.offer_id = ?
            GROUP BY v.user_id
        `, [offerId])
        // console.log(viewCountByUser)

        const mytags = req.db.query( //获取我这个商品我的标签
            `SELECT  t.created_at, t.text, t.font_color, t.bg_color, pt.visible
             FROM tags t
             JOIN product_tags pt ON t.id = pt.tag_id
             WHERE pt.offer_id = ? AND pt.tag_user = ?`,
            [offerId, req.user.id]
        )
        console.log(mytags)



        res.json({
            message: '根据商品id获取到的我的商品信息',
            text: result,
            viewuser: viewCountByUser,// 浏览记录用户
            viewCount: viewCount.count,// 浏览记录数量
            textCount: textCount.count,// 评论数量
            tagsCount: tags.count,// 商品标签数量 
            mytags: mytags,// 商品标签
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: '报错了' })
    }
})

export default router