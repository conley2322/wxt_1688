import bcrypt from 'bcryptjs'
import { Router } from 'express'
const router = Router()

router.post('/', (req, res) => {
  try {
    const { username, email, password, role } = req.body
    if (!username || !email || !password) {
      return res.status(400).json({ code: 400, message: '用户名、邮箱和密码不能为空' })
    }

    const existing = req.db.get('SELECT id FROM users WHERE username = ?', [username])
    if (existing) {
      return res.status(409).json({ code: 409, message: '用户名已存在' })
    }

    const hashedPassword = bcrypt.hashSync(password, 10)
    const result = req.db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'user']
    )

    res.json({ code: 200, data: { id: result.lastInsertRowid }, message: '用户创建成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
