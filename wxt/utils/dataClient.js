// dataClient.js — 单机版数据客户端（content script 专用入口）
// IndexedDB 按 origin 隔离，content script 直接读写只能拿到“当前网站自己的库”，
// 与扩展页面/其他网站互不相通。因此所有数据操作统一通过 runtime 消息
// 交给 background（扩展 origin 的唯一数据库）执行。

export async function api(path, method = 'GET', body = undefined) {
  try {
    const res = await browser.runtime.sendMessage({ type: 'local-api', path, method, body })
    return res || { code: 500, message: 'background 无响应' }
  } catch (e) {
    console.error('[dataClient]', method, path, e)
    return { code: 500, message: '本地数据通道异常: ' + e.message }
  }
}
