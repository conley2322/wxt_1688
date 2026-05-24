/**
 * 统一存储工具
 * 优先用 browser.storage.local（扩展环境），
 * 不可用时降级到 window.localStorage（dev 直接打开页面）
 */
const store = {
  async get(key) {
    try {
      if (browser?.storage?.local) {
        const result = await browser.storage.local.get(key)
        return result
      }
    } catch {}
    try {
      const val = localStorage.getItem(key)
      return val ? { [key]: JSON.parse(val) } : {}
    } catch {
      return {}
    }
  },

  async set(data) {
    try {
      if (browser?.storage?.local) {
        await browser.storage.local.set(data)
        return
      }
    } catch {}
    try {
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
    } catch {}
  },

  async remove(key) {
    try {
      if (browser?.storage?.local) {
        await browser.storage.local.remove(key)
        return
      }
    } catch {}
    try {
      localStorage.removeItem(key)
    } catch {}
  },
}

export default store