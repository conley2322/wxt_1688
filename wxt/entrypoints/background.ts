export default defineBackground(() => {
  // API 代理：content script / popup 通过消息请求，由 background 发起 fetch（绕过混合内容限制）
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'api-request') return false

    const { url, method, headers, body } = message
    fetch(url, { method, headers, body })
      .then(async (res) => {
        const data = await res.json()
        sendResponse({ ok: res.ok, status: res.status, data })
      })
      .catch((err) => {
        sendResponse({ ok: false, status: 0, data: null, error: err.message })
      })

    return true // 保持 sendResponse 通道开放（异步响应）
  })
});
