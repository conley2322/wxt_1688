import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * JWT 认证中间件
 * 从 Authorization header 提取 Bearer token，解析后将用户信息挂到 req.user
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = { ...decoded, id: String(decoded.id) }
    next()
  } catch (err) {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' })
  }
}