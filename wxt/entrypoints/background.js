// background.js — 数据中枢
// 1. local-api：content script 通过消息读写扩展 origin 的 IndexedDB（全扩展共享一份）
// 2. remote-sync：多人模式同步（推送共享数据 + 拉取他人数据），按设置自动或仅手动
import { handle } from '../utils/localapi.js'
import { syncOnce } from '../utils/remoteClient.js'

const ALARM_NAME = 'alocs-sync'

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

  browser.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM_NAME) safeSync()
  })

  // 按「同步方式 + 间隔」重建定时闹钟
  async function applySchedule() {
    const { syncMode, syncInterval } = await browser.storage.local.get(['syncMode', 'syncInterval'])
    await browser.alarms.clear(ALARM_NAME)
    if (syncMode !== 'manual') {
      browser.alarms.create(ALARM_NAME, { periodInMinutes: syncInterval || 5 })
    }
  }

  // 设置改动时立即生效（不用等 SW 重启）
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.syncMode || changes.syncInterval)) applySchedule()
  })

  // 浏览器启动 / 扩展安装更新：自动模式才同步，手动模式不打扰
  browser.runtime.onStartup.addListener(() => { applySchedule(); autoSyncIfEnabled() })
  browser.runtime.onInstalled.addListener(() => { applySchedule(); autoSyncIfEnabled() })

  applySchedule()
  autoSyncIfEnabled()

  async function autoSyncIfEnabled() {
    const { syncMode } = await browser.storage.local.get('syncMode')
    if (syncMode === 'manual') return
    safeSync()
  }

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
