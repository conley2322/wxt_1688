import { Router } from 'express'
const router = Router({ mergeParams: true })

router.get('/', (req, res) => {
  try {
    const { id } = req.params
    const user = req.db.get('SELECT id, username, email, role, status, created_at FROM users WHERE id = ?', [id])
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }
    res.json({ code: 200, data: user })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
