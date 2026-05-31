import { Router } from 'express'
const router = Router()

// PUT /api/v1/tags/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    const { visibility } = req.body
    console.log('[tag_update]', id, visibility, 'user:', req.user.id, req.user.role)

    const tag = req.db.get('SELECT * FROM tags WHERE id = ?', [id])
    console.log('[tag_update] tag found:', tag ? tag.text : 'NOT FOUND')
    if (!tag) {
      return res.status(404).json({ code: 404, message: '标签不存在' })
    }
    if (String(tag.creator_id) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '只能修改自己创建的标签' })
    }

    req.db.run('UPDATE tags SET visibility = ? WHERE id = ?', [visibility || 'public', id])
    res.json({ code: 200, message: '标签已更新' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
