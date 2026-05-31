import { Router } from 'express'
const router = Router()

// DELETE /api/v1/suppliers/tags/:tag_id
router.delete('/:tag_id', (req, res) => {
  try {
    const { tag_id } = req.params
    const { supplier_name } = req.query
    const user_id = req.user.id

    if (!supplier_name) {
      return res.status(400).json({ code: 400, message: '缺少 supplier_name' })
    }

    const supplier = req.db.get('SELECT id FROM suppliers WHERE name = ?', [supplier_name])
    if (!supplier) {
      return res.status(404).json({ code: 404, message: '供应商不存在' })
    }

    const record = req.db.get(
      'SELECT * FROM supplier_tags WHERE supplier_id = ? AND tag_id = ?',
      [supplier.id, tag_id]
    )
    if (!record) {
      return res.status(404).json({ code: 404, message: '标签关联不存在' })
    }
    if (String(record.tag_user) !== String(user_id)) {
      return res.status(403).json({ code: 403, message: '只能移除自己打的标签' })
    }

    req.db.run(
      'DELETE FROM supplier_tags WHERE supplier_id = ? AND tag_id = ? AND tag_user = ?',
      [supplier.id, tag_id, user_id]
    )

    res.json({ code: 200, message: '标签已移除' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
