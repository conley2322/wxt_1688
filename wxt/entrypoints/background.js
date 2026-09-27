// background.js — 数据中枢
// 1. local-api：content script 通过消息读写扩展 origin 的 IndexedDB（全扩展共享一份）
// 2. remote-sync：多人模式定时批量同步（推送共享数据 + 拉取他人数据）
import { handle } from '../utils/localapi.js'
import { syncOnce } from '../utils/remoteClient.js'

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'local-api') {
      handle(message.path, message.method, message.body).then(sendResponse)
      return true // 保持异步响应通道
    }
    if (message?.type === 'remote-sync') {
      safeSync().then(data => sendResponse({ code: 200, data }))
        .catch(e => sendResponse({ code: 500, message: e.message }))
      return true
    }
  })

  // 每 5 分钟定时同步
  browser.alarms.create('alocs-sync', { periodInMinutes: 5 })
  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === 'alocs-sync') safeSync()
  })
  // 浏览器启动 / 扩展安装更新时同步
  browser.runtime.onStartup.addListener(safeSync)
  browser.runtime.onInstalled.addListener(safeSync)
  // service worker 每次唤醒也尝试（未配置服务器会立即跳过，开销极小）
  safeSync()

  let syncing = false
  async function safeSync() {
    if (syncing) return null
    syncing = true
    try {
      return await syncOnce()
    } catch (e) {
      console.warn('[remote-sync]', e.message)
      return null
    } finally {
      syncing = false
    }
  }
})
