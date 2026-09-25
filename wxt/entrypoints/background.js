// background.js — 单机版数据中枢
// IndexedDB 按 origin 隔离：detail.1688.com / www.1688.com / 扩展页面各自一份，
// 互相看不见。因此数据库只放在扩展 origin（这里），所有 content script
// 通过 runtime 消息（type: 'local-api'）读写，保证全扩展共享同一份数据。
import { handle } from '../utils/localapi.js'

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'local-api') return
    handle(message.path, message.method, message.body).then(sendResponse)
    return true // 保持 sendResponse 通道开放（异步响应）
  })
})
