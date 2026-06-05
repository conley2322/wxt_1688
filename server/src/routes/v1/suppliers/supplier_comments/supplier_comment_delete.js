import { Router } from 'express'
import { deleteImagesFromText } from '../../../../utils/deleteImages.js'
const router = Router()

// DELETE /api/v1/suppliers/comments/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    const user_id = req.user.id

    const comment = req.db.get('SELECT * FROM supplier_comments WHERE id = ?', [id])
    if (!comment) {
      return res.status(404).json({ code: 404, message: '评论不存在' })
    }
    if (String(comment.user_id) !== String(user_id)) {
      return res.status(403).json({ code: 403, message: '只能删除自己的评论' })
    }

    // 删除评论中的图片文件
    deleteImagesFromText(comment.text)

    req.db.run('DELETE FROM supplier_comments WHERE id = ?', [id])

    res.json({ code: 200, message: '删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
