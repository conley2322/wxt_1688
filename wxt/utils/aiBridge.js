// aiBridge.js — content script 里的 AI 调用桥
// 网页 origin 直连 AI 接口会被 CORS 拦截，这里转给 background（扩展 origin）发请求。

export async function aiChat(payload, requestId) {
  try {
    const res = await browser.runtime.sendMessage({ type: 'ai-chat', payload, requestId })
    if (!res) return { code: 500, message: 'background 无响应' }
    return res
  } catch (e) {
    return { code: 500, message: 'AI 请求通道异常：' + e.message }
  }
}

export function aiAbort(requestId) {
  if (!requestId) return
  browser.runtime.sendMessage({ type: 'ai-abort', requestId }).catch(() => {})
}
