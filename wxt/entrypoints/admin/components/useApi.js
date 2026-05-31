export async function api(path, method, body) {
  const stored = await browser.storage.local.get(['token', 'serverAddress'])
  console.log('[Admin API]', method, path, body || '')
  if (!stored.token) throw new Error('未登录')
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${stored.token}`, 'Content-Type': 'application/json' }
  }
  if (body) opts.body = JSON.stringify(body)
  const url = `${stored.serverAddress}${path}`
  console.log('[Admin API] 请求:', url)
  const res = await fetch(url, opts)
  const data = await res.json()
  console.log('[Admin API] 响应:', res.status, JSON.stringify(data).substring(0, 200))
  return data
}
