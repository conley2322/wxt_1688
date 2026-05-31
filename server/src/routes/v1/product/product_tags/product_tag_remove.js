import { Router } from 'express'
const router = Router({ mergeParams: true })

// DELETE /api/v1/products/:offer_id/tags/:tag_id
router.delete('/:tag_id', (req, res) => {
  try {
    const { offer_id, tag_id } = req.params
    const user_id = req.user.id

    const record = req.db.get(
      'SELECT * FROM product_tags WHERE offer_id = ? AND tag_id = ?',
      [offer_id, tag_id]
    )
    if (!record) {
      return res.status(404).json({ code: 404, message: '标签关联不存在' })
    }
    if (String(record.tag_user) !== String(user_id)) {
      return res.status(403).json({ code: 403, message: '只能移除自己打的标签' })
    }

    req.db.run(
      'DELETE FROM product_tags WHERE offer_id = ? AND tag_id = ? AND tag_user = ?',
      [offer_id, tag_id, user_id]
    )

    res.json({ code: 200, message: '标签已移除' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
