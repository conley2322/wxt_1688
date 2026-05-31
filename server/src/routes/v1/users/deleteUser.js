import { Router } from 'express'
const router = Router({ mergeParams: true })

router.delete('/', (req, res) => {
  try {
    const { id } = req.params
    const result = req.db.run('DELETE FROM users WHERE id = ?', [id])
    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }
    res.json({ code: 200, message: '删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
