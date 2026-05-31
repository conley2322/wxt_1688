import { Router } from 'express'
const router = Router({ mergeParams: true })

router.put('/', (req, res) => {
  try {
    const { id } = req.params
    const { username, email, status, role } = req.body
    const fields = []
    const values = []

    if (username !== undefined) { fields.push('username = ?'); values.push(username) }
    if (email !== undefined) { fields.push('email = ?'); values.push(email) }
    if (status !== undefined) { fields.push('status = ?'); values.push(status) }
    if (role !== undefined) { fields.push('role = ?'); values.push(role) }

    if (fields.length === 0) {
      return res.status(400).json({ code: 400, message: '没有需要更新的字段' })
    }

    values.push(id)
    const result = req.db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    res.json({ code: 200, message: '更新成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
