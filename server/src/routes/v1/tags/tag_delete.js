import { Router } from 'express'
const router = Router()

// DELETE /api/v1/tags/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    const user_id = req.user.id

    const tag = req.db.get('SELECT * FROM tags WHERE id = ?', [id])
    if (!tag) {
      return res.status(404).json({ code: 404, message: '标签不存在' })
    }
    if (String(tag.creator_id) !== String(user_id) && req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '只能删除自己创建的标签' })
    }

    // 删除标签关联 + 标签本身
    req.db.run('DELETE FROM product_tags WHERE tag_id = ?', [id])
    req.db.run('DELETE FROM supplier_tags WHERE tag_id = ?', [id])
    req.db.run('DELETE FROM tags WHERE id = ?', [id])

    res.json({ code: 200, message: '标签已删除' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
