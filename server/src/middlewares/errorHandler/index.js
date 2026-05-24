export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message)
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误'
  })
}
