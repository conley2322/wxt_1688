import { createApp, reactive } from 'vue'
import { createPinia } from 'pinia'
import App from '../entrypoints/box/App.vue'

export default defineContentScript({
  matches: ['*://s.1688.com/selloffer/*', '*://search.1688.com/selloffer/*', '*://www.1688.com/*'],

  main() {
    // ── 检查登录状态 ──
    async function checkLogin() {
      const stored = await browser.storage.local.get(['token'])
      return !!stored.token
    }

    async function showLoginTip() {
      const loggedIn = await checkLogin()
      if (loggedIn) return false

      // 未登录，显示提示条
      if (document.getElementById('__1688_login_tip__')) return true
      const bar = document.createElement('div')
      bar.id = '__1688_login_tip__'
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff3cd;color:#856404;text-align:center;padding:8px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Arial,sans-serif;border-bottom:1px solid #ffc107;'
      bar.textContent = '⚠ 请先点击浏览器右上角的 1688 助手图标登录'
      document.body.prepend(bar)
      return true
    }

    const pinia = createPinia()

    // ── 渲染配置 ──
    // parent: 外层容器选择器
    // child:  要插入组件的子元素选择器（相对于 parent）
    // 组件会注入到每个 parent 下的 child 里面
    const renderConfigs = [
      { parent: '.feeds-wrapper', child: '> a' },
      { parent: '[class*="offerListLayoutWrapper"]', child: '[class*="searchOfferWrapper"]' },
      { parent: '.swiper-slide .list-padding', child: '.offer-card-container div' },
    ]

    // 共享的批量数据缓存
    const batchCache = reactive({})

    // 提取 offer_id
    function extractOfferId(el) {
      const href = el.getAttribute('href') || ''
      const dataRenderkey = el.getAttribute('data-renderkey') || ''
      const dataAplus = el.getAttribute('data-aplus-report') || ''
      const linkEl = el.querySelector('a[href*="offerId="]') || el

      const matchHref = href.match(/offerId=(\d+)/)?.[1]
      const matchRenderkey = dataRenderkey.match(/_(\d+)$/)?.[1]
      const matchOfferId = dataAplus.match(/offerId@(\d+)/)?.[1]
      const matchObjectId = dataAplus.match(/object_id@(\d+)/)?.[1]
      const matchLinkHref = linkEl?.href?.match(/offerId=(\d+)/)?.[1]

      return matchRenderkey || matchHref || matchOfferId || matchObjectId || matchLinkHref
    }

    // 防重：记录最近一次请求的 offer_ids 指纹，避免重复请求
    let lastRequestFingerprint = ''
    let requestTimer = null

    async function loadBatchData() {
      // 从所有配置中收集卡片
      const allCards = renderConfigs.flatMap(cfg =>
        Array.from(document.querySelectorAll(`${cfg.parent} ${cfg.child}`))
      )
      const offerIds = new Set()

      allCards.forEach(card => {
        const id = extractOfferId(card)
        if (id) offerIds.add(id)
      })

      if (offerIds.size === 0) return

      // 去重：相同的 offer_ids 集合 2 秒内不重复请求
      const fingerprint = [...offerIds].sort().join(',')
      if (fingerprint === lastRequestFingerprint) return
      lastRequestFingerprint = fingerprint

      try {
        const stored = await browser.storage.local.get(['token', 'serverAddress'])
        if (!stored.token) return

        const res = await fetch(`${stored.serverAddress}/api/v1/products/batch_info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${stored.token}`
          },
          body: JSON.stringify({ offer_ids: [...offerIds] })
        })
        const json = await res.json()
        if (json.code === 200) {
          Object.assign(batchCache, json.data)
        }
      } catch (e) {
        console.error('Box 批量查询失败:', e)
      }
    }

    const render = (parentSelector, childSelector) => {
      const selector = `${parentSelector} ${childSelector}`
      document.querySelectorAll(selector).forEach((item) => {
        if (item.dataset.rendered) return
        item.dataset.rendered = 'true'

        const offerId = extractOfferId(item)

        const container = document.createElement('div')
        item.appendChild(container)
        const app = createApp(App, {
          parentEl: item,
          offerId,
          batchCache
        })
        app.use(pinia)
        app.mount(container)

        requestAnimationFrame(() => {
          if (!container.isConnected) return
          const parent = container.parentNode
          while (container.firstChild) {
            parent.insertBefore(container.firstChild, container)
          }
          parent.removeChild(container)
        })
      })
    }

    const renderAll = async () => {
      const needLogin = await showLoginTip()
      if (needLogin) return
      loadBatchData()
      renderConfigs.forEach(cfg => render(cfg.parent, cfg.child))
    }

    renderAll()

    new MutationObserver(() => setTimeout(renderAll, 100))
      .observe(document.body, { childList: true, subtree: true })
  },
})
