import { Router } from 'express'
const router = Router()

// POST /api/v1/suppliers
// 供应商不存在则创建，已存在则更新 memberId（如果传入且为空）
router.post('/', (req, res) => {
  try {
    const { name, memberId } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ code: 400, message: '缺少供应商名称' })
    }

    let supplier = req.db.get('SELECT * FROM suppliers WHERE name = ?', [name.trim()])

    if (supplier) {
      // 已存在，如果 memberId 为空且传入了，则更新
      if (!supplier.memberId && memberId) {
        req.db.run('UPDATE suppliers SET memberId = ? WHERE id = ?', [memberId, supplier.id])
      }
      return res.json({ code: 200, message: '供应商已存在', data: { id: supplier.id } })
    }

    // 创建新供应商
    const id = crypto.randomUUID()
    req.db.run(
      'INSERT INTO suppliers (id, name, memberId) VALUES (?, ?, ?)',
      [id, name.trim(), memberId || null]
    )

    res.json({ code: 200, message: '供应商已创建', data: { id } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
