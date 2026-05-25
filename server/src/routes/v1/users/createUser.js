import bcrypt from 'bcryptjs'
import { generateId } from '../../../database/init.js'
import { Router } from 'express'
const router = Router()

router.post('/', (req, res, next) => {
  try {
    const { username, email, password, color } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ code: 400, message: '用户名、邮箱和密码不能为空' })
    }

    const existing = req.db.get('SELECT id FROM users WHERE username = ?', [username])
    if (existing) {
      return res.status(409).json({ code: 409, message: '用户名已存在' })
    }

    const id = generateId()
    const hashedPassword = bcrypt.hashSync(password, 10)
    req.db.run(
      'INSERT INTO users (id, username, email, password, color) VALUES (?, ?, ?, ?, ?)',
      [id, username, email, hashedPassword, color || null]
    )

    res.status(201).json({ code: 201, data: { id }, message: '用户创建成功' })
  } catch (error) {
    next(error)
  }
})

export default router