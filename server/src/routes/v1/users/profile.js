import { Router } from 'express'
import bcrypt from 'bcryptjs'

const router = Router()

// PUT / — 当前用户修改个人资料
router.put('/', (req, res) => {
  try {
    const userId = req.user.id
    const { avatar_color, avatar, email, current_password, new_password } = req.body

    const user = req.db.get('SELECT * FROM users WHERE id = ?', [userId])
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    const fields = []
    const values = []

    // 头像颜色
    if (avatar_color !== undefined) {
      fields.push('avatar_color = ?')
      values.push(avatar_color)
    }

    // 头像 URL
    if (avatar !== undefined) {
      fields.push('avatar = ?')
      values.push(avatar)
    }

    // 邮箱
    if (email !== undefined) {
      if (email && email !== user.email) {
        const existing = req.db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId])
        if (existing) {
          return res.status(400).json({ code: 400, message: '该邮箱已被其他用户使用' })
        }
      }
      fields.push('email = ?')
      values.push(email)
    }

    // 密码修改（需要旧密码验证）
    if (new_password !== undefined && new_password !== '') {
      if (!current_password) {
        return res.status(400).json({ code: 400, message: '请输入当前密码' })
      }
      const isValid = bcrypt.compareSync(current_password, user.password)
      if (!isValid) {
        return res.status(400).json({ code: 400, message: '当前密码错误' })
      }
      fields.push('password = ?')
      values.push(bcrypt.hashSync(new_password, 10))
    }

    if (fields.length === 0) {
      return res.status(400).json({ code: 400, message: '没有需要更新的字段' })
    }

    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(userId)
    req.db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)

    // 返回更新后的用户信息（不含密码）
    const updated = req.db.get(
      'SELECT id, username, email, avatar, avatar_color, role, status, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    )

    res.json({ code: 200, message: '更新成功', data: updated })
  } catch (error) {
    console.error('[profile] 更新失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
