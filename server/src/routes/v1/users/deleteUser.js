export const deleteUser = (req, res, next) => {
  try {
    const changes = req.db.run('DELETE FROM users WHERE id = ?', [req.params.id])
    if (changes.changes === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' })
    }
    res.json({ code: 200, message: '用户删除成功' })
  } catch (error) {
    next(error)
  }
}
