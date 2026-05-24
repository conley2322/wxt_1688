export const hello = (req, res) => {
  res.json({
    code: 200,
    message: 'Success',
    data: { message: 'Hello from server!' }
  })
}
