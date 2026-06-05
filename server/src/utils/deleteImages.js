import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../uploads')

/**
 * 删除评论文本中引用的图片文件
 * @param {string} text 评论内容（可能包含 <img src="/uploads/...">）
 */
export function deleteImagesFromText(text) {
  if (!text) {
    console.log('[deleteImages] 文本为空，跳过')
    return
  }

  console.log('[deleteImages] 检查文本:', text.substring(0, 200))

  // 匹配 <img src="/uploads/..."> 或 /uploads/... 格式的图片路径
  const regex = /\/uploads\/([^"'\s>)]+)/g
  const matches = [...text.matchAll(regex)]

  console.log('[deleteImages] 匹配到', matches.length, '个图片')

  for (const match of matches) {
    const filePath = path.join(uploadsDir, match[1])
    console.log('[deleteImages] 目标文件:', filePath)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log('[deleteImages] ✅ 已删除:', filePath)
      } else {
        console.log('[deleteImages] ⚠ 文件不存在:', filePath)
      }
    } catch (e) {
      console.warn('[deleteImages] ❌ 删除失败:', filePath, e.message)
    }
  }
}

/**
 * 对比新旧文本，删除不再被引用的图片
 * @param {string} oldText 编辑前的评论文本
 * @param {string} newText 编辑后的评论文本
 */
export function deleteRemovedImages(oldText, newText) {
  if (!oldText) return

  const regex = /\/uploads\/([^"'\s>)]+)/g
  const oldImages = new Set([...oldText.matchAll(regex)].map(m => m[1]))
  const newImages = new Set((newText || '').matchAll(regex) ? [...(newText || '').matchAll(regex)].map(m => m[1]) : [])

  for (const name of oldImages) {
    if (!newImages.has(name)) {
      const filePath = path.join(uploadsDir, name)
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log('[deleteImages] ✅ 已清理旧图片:', filePath)
        }
      } catch (e) {
        console.warn('[deleteImages] ❌ 清理失败:', filePath, e.message)
      }
    }
  }
}
