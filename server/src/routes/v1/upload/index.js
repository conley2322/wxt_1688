import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { authenticate } from '../../../middlewares/auth/index.js'
import config from '../../../config/index.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../../../uploads')

// 确保上传根目录存在
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// POST /api/v1/upload/image
router.post('/image', authenticate, (req, res) => {
  try {
    const { image, fileName } = req.body
    const { username } = req.user

    if (!image) {
      return res.status(400).json({ code: 400, message: '缺少图片数据' })
    }

    // 提取 base64 数据
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return res.status(400).json({ code: 400, message: '无效的图片格式' })
    }

    // 创建用户文件夹
    const userDir = path.join(uploadsDir, username)
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true })
      if (!config.isProduction) console.log('[upload] 用户文件夹已创建:', userDir)
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const name = fileName ? path.parse(fileName).name : crypto.randomUUID()
    const filename = `${Date.now()}_${name}.${ext}`
    const filepath = path.join(userDir, filename)

    // 写入文件
    const buffer = Buffer.from(matches[2], 'base64')
    if (!config.isProduction) console.log('[upload] 写入文件:', filepath, '大小:', buffer.length, 'bytes')
    fs.writeFileSync(filepath, buffer)

    // 验证文件是否写入成功
    if (!fs.existsSync(filepath)) {
      console.error('[upload] 文件写入失败!', filepath)
      return res.status(500).json({ code: 500, message: '文件保存失败' })
    }
    const stat = fs.statSync(filepath)
    if (!config.isProduction) console.log('[upload] 文件已保存:', filepath, '磁盘大小:', stat.size, 'bytes')

    const url = `/uploads/${username}/${filename}`
    res.json({ code: 200, data: { url } })
  } catch (error) {
    console.error('[upload] 错误:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
})

export default router