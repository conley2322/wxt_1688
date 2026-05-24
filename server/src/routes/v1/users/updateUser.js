export const updateUser = (req, res, next) => {
  try {
    const { username, email, color, status, role } = req.body
    const fields = []
    const values = []

    if (username !== undefined) {
      fields.push('username = ?')
      values.push(username)
    }
    if (email !== undefined) {
      fields.push('email = ?')
      values.push(email)
    }
    if (color !== undefined) {
      fields.push('color = ?')
      values.push(color)
    }
    if (status !== undefined) {
      fields.push('status = ?')
      values.push(status)
    }
    if (role !== undefined) {
      fields.push('role = ?')
      values.push(role)
    }

    if (fields.length === 0) {
      return res.status(400).json({ code: 400, message: '没有需要更新的字段' })
    }

    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(req.params.id)

    const changes = req.db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    if (changes.changes === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }

    res.json({ code: 200, message: '用户更新成功' })
  } catch (error) {
    next(error)
  }
}
