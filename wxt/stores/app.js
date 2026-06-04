import { defineStore } from 'pinia'
import { reactive, computed } from 'vue'

/**
 * 全局应用配置 Store
 *
 * 所有页面共享一个 config 对象，结构如下：
 *
 *   config.app       应用基本信息（只读）
 *   config.settings  用户设置（可读写，自动持久化）
 *   config.update    版本更新状态（运行时计算）
 *
 * 使用方式：
 *   import { useAppStore } from '@/stores/app.js'
 *   const app = useAppStore()
 *   app.config.app.name              // "ALOCS-1688 采购助手"
 *   app.config.settings.enableSearchList  // true | false
 *   app.config.update.hasUpdate      // true | false
 */
export const useAppStore = defineStore('app', () => {

  // ═══════════════════════════════════════════════════════════════
  // 1. 默认值（纯 JSON，用于重置和参考）
  // ═══════════════════════════════════════════════════════════════
  const defaults = {
    app: {
      name: 'ALOCS-1688 采购助手',
      description: '1688 商品采购管理扩展',
      version: '0.0.0',
    },
    settings: {
      /** 启动时自动检查更新 */
      autoCheckUpdate: true,
      /** 商品列表默认视图：'table' | 'masonry' */
      defaultProductView: 'table',
      /** 搜索列表页渲染：s.1688.com / search.1688.com */
      enableSearchList: true,
      /** 货源列表页渲染：offerListLayoutWrapper */
      enableOfferList: true,
      /** 首页推荐渲染：www.1688.com swiper */
      enableHomeRecommend: true,
    },
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. 运行时配置（reactive，所有组件实时共享）
  // ═══════════════════════════════════════════════════════════════
  const config = reactive({
    app: {
      name: defaults.app.name,
      description: defaults.app.description,
      version: defaults.app.version,
    },
    settings: { ...defaults.settings },
    update: {
      latestVersion: null,
      releaseUrl: '',
      checkedAt: null,
    },
  })

  // computed 属性注入（reactive 内对 computed ref 自动解包）
  config.update.hasUpdate = computed(() => {
    if (!config.update.latestVersion || !config.app.version) return false
    return compareVersions(config.update.latestVersion, config.app.version) > 0
  })

  // ═══════════════════════════════════════════════════════════════
  // 3. 初始化
  // ═══════════════════════════════════════════════════════════════

  /** 应用初始化：读 manifest 版本号 + 从 storage 恢复设置 */
  async function init() {
    // 从 manifest 读取版本号
    try {
      const manifest = browser.runtime.getManifest()
      config.app.version = manifest.version || defaults.app.version
    } catch (e) {
      console.warn('[appStore] 无法读取 manifest 版本:', e)
    }

    // 从 storage 恢复用户设置
    await _restoreSettings()

    console.log(
      `[appStore] 初始化完成 — ${config.app.name} v${config.app.version}`,
      '\n  设置:', JSON.stringify(config.settings)
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. 设置读写
  // ═══════════════════════════════════════════════════════════════

  /**
   * 保存设置到 browser.storage.local
   * @param {Object} [patch] 部分更新，如 { defaultProductView: 'masonry' }
   */
  async function saveSettings(patch) {
    if (patch) {
      Object.assign(config.settings, patch)
    }
    try {
      // 强转纯 JSON 确保可靠序列化
      const plain = JSON.parse(JSON.stringify(config.settings))
      console.log('[appStore] 保存设置:', plain)
      await browser.storage.local.set({ appSettings: plain })
    } catch (e) {
      console.warn('[appStore] 保存设置失败:', e)
    }
  }

  /** 从 storage 恢复设置（init 时自动调用） */
  async function _restoreSettings() {
    try {
      const stored = await browser.storage.local.get('appSettings')
      if (stored.appSettings) {
        Object.assign(config.settings, stored.appSettings)
        console.log('[appStore] 已恢复设置')
      }
    } catch (e) {
      console.warn('[appStore] 恢复设置失败:', e)
    }
  }

  /** 重置设置为默认值 */
  async function resetSettings() {
    Object.assign(config.settings, JSON.parse(JSON.stringify(defaults.settings)))
    await saveSettings()
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. 版本更新检查
  // ═══════════════════════════════════════════════════════════════

  /**
   * 向服务端查询最新版本
   * 接口：GET /api/v1/updates/latest-version
   * 返回：{ code: 200, data: { version: "1.2.0", url: "..." } }
   */
  async function checkUpdate() {
    try {
      const stored = await browser.storage.local.get(['serverAddress', 'token'])
      if (!stored.serverAddress) {
        console.log('[appStore] 未配置服务器地址，跳过更新检查')
        return
      }

      const url = `${stored.serverAddress}/api/v1/updates/latest-version`
      const headers = { 'Content-Type': 'application/json' }
      if (stored.token) {
        headers['Authorization'] = `Bearer ${stored.token}`
      }

      const res = await fetch(url, { headers })
      const data = await res.json()

      if (data.code === 200 && data.data) {
        config.update.latestVersion = data.data.version || null
        config.update.releaseUrl = data.data.url || ''
        config.update.checkedAt = new Date().toISOString()
      }
    } catch (e) {
      console.warn('[appStore] 检查更新失败:', e)
    }
  }

  /** 忽略当前更新 */
  function dismissUpdate() {
    config.update.latestVersion = null
    config.update.releaseUrl = ''
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. 工具函数
  // ═══════════════════════════════════════════════════════════════

  /**
   * semver 版本号比较
   * @returns {number} a>b→1 | a<b→-1 | a=b→0
   */
  function compareVersions(a, b) {
    if (!a || !b) return 0
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      const na = pa[i] || 0
      const nb = pb[i] || 0
      if (na > nb) return 1
      if (na < nb) return -1
    }
    return 0
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. 导出
  // ═══════════════════════════════════════════════════════════════
  return {
    /** 完整配置对象：config.app / config.settings / config.update */
    config,
    /** 默认值（用于重置或参考） */
    defaults,

    // 方法
    init,
    saveSettings,
    resetSettings,
    checkUpdate,
    dismissUpdate,
  }
})
