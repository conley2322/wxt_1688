import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Router } from 'express'
const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

router.post('/', (req, res, next) => {
  try {
    const { username, password } = req.body
    console.log(username, password)
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '请输入用户名和密码' })
    }

    const user = req.db.get('SELECT * FROM users WHERE username = ?', [username])
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户不存在' })
    }

    const isValid = bcrypt.compareSync(password, user.password)
    if (!isValid) {
      return res.status(401).json({ code: 401, message: '密码错误' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      code: 200,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          color: user.color,
          status: user.status,
          role: user.role
        }
      },
      message: '登录成功'
    })
  } catch (error) {
    next(error)
  }
})

export default router