import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../../../uploads')

// 确保上传目录存在
console.log('[upload] 上传目录:', uploadsDir)
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  console.log('[upload] 目录已创建')
} else {
  console.log('[upload] 目录已存在')
}

// POST /api/v1/upload/image
router.post('/image', (req, res) => {
  try {
    // 从 base64 body 接收
    const { image, fileName } = req.body

    if (!image) {
      return res.status(400).json({ code: 400, message: '缺少图片数据' })
    }

    // 提取 base64 数据
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return res.status(400).json({ code: 400, message: '无效的图片格式' })
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const name = fileName ? path.parse(fileName).name : crypto.randomUUID()
    const filename = `${Date.now()}_${name}.${ext}`
    const filepath = path.join(uploadsDir, filename)

    // 写入文件
    const buffer = Buffer.from(matches[2], 'base64')
    console.log('[upload] 写入文件:', filepath, '大小:', buffer.length, 'bytes')
    fs.writeFileSync(filepath, buffer)

    // 验证文件是否写入成功
    if (!fs.existsSync(filepath)) {
      console.error('[upload] 文件写入失败!', filepath)
      return res.status(500).json({ code: 500, message: '文件保存失败' })
    }
    const stat = fs.statSync(filepath)
    console.log('[upload] 文件已保存:', filepath, '磁盘大小:', stat.size, 'bytes')

    const url = `/uploads/${filename}`
    res.json({ code: 200, data: { url } })
  } catch (error) {
    console.error('[upload] 错误:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router
