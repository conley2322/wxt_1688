import { Router } from 'express'
const router = Router()

// PUT /api/v1/products/comments/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    const { text } = req.body
    const user_id = req.user.id

    if (!text || !text.trim()) {
      return res.status(400).json({ code: 400, message: '评论内容不能为空' })
    }

    const comment = req.db.get('SELECT * FROM product_comments WHERE id = ?', [id])
    if (!comment) {
      return res.status(404).json({ code: 404, message: '评论不存在' })
    }
    if (String(comment.user_id) !== String(user_id)) {
      return res.status(403).json({ code: 403, message: '只能修改自己的评论' })
    }

    const now = new Date().toISOString()
    req.db.run('UPDATE product_comments SET text = ?, updated_at = ? WHERE id = ?', [text.trim(), now, id])

    res.json({ code: 200, message: '修改成功', data: { updated_at: now } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
