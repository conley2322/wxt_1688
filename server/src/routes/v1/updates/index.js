import { Router } from 'express'
import { authenticate } from '../../../middlewares/auth/index.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const updates = await req.db.query(`
      SELECT * FROM product_updates 
      WHERE status = 'published' 
      ORDER BY created_at DESC
    `)
    res.json({
      code: 200,
      data: updates,
      message: '获取成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取失败',
      error: error.message
    })
  }
})

router.get('/all', async (req, res) => {
  try {
    const updates = await req.db.query(`
      SELECT * FROM product_updates 
      ORDER BY created_at DESC
    `)
    res.json({
      code: 200,
      data: updates,
      message: '获取成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取失败',
      error: error.message
    })
  }
})

router.post('/', authenticate, async (req, res) => {
  const { version, title, content, status = 'draft' } = req.body

  if (!version || !title || !content) {
    return res.status(400).json({
      code: 400,
      message: '版本号、标题和内容不能为空'
    })
  }

  try {
    const id = crypto.randomUUID()
    await req.db.run(`
      INSERT INTO product_updates (id, version, title, content, status, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `, [id, version, title, content, status, req.user.username])

    res.json({
      code: 200,
      data: { id },
      message: '创建成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '创建失败',
      error: error.message
    })
  }
})

router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params
  const { version, title, content, status } = req.body

  try {
    const existing = await req.db.get('SELECT * FROM product_updates WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({
        code: 404,
        message: '更新记录不存在'
      })
    }

    const updates = []
    const params = []

    if (version) { updates.push('version = ?'); params.push(version) }
    if (title) { updates.push('title = ?'); params.push(title) }
    if (content) { updates.push('content = ?'); params.push(content) }
    if (status) { updates.push('status = ?'); params.push(status) }
    updates.push('updated_by = ?'); params.push(req.user.username)
    updates.push(`updated_at = datetime('now', 'localtime')`)

    await req.db.run(`
      UPDATE product_updates SET ${updates.join(', ')} WHERE id = ?
    `, [...params, id])

    res.json({
      code: 200,
      message: '更新成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '更新失败',
      error: error.message
    })
  }
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const existing = await req.db.get('SELECT * FROM product_updates WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({
        code: 404,
        message: '更新记录不存在'
      })
    }

    await req.db.run('DELETE FROM product_updates WHERE id = ?', [id])

    res.json({
      code: 200,
      message: '删除成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '删除失败',
      error: error.message
    })
  }
})

// 获取最新版本号（供扩展端检查更新）
router.get('/latest-version', async (req, res) => {
  try {
    const latest = await req.db.get(`
      SELECT version, title, created_at FROM product_updates
      WHERE status = 'published'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    res.json({
      code: 200,
      data: latest || null,
      message: '获取成功'
    })
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取失败',
      error: error.message
    })
  }
})

export default router
