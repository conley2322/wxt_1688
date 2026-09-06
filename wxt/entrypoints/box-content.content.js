import { createApp, reactive } from 'vue'
import { createPinia } from 'pinia'
import App from '../entrypoints/box/App.vue'

// 列表页域名：搜索结果 / 货源列表 / 首页（原有 renderConfigs 规则）
const LIST_HOSTS = ['s.1688.com', 'search.1688.com', 'www.1688.com']
// 详情页由 win-content.content.js 负责，box 不参与
const DETAIL_HOST = 'detail.1688.com'

export default defineContentScript({
  // Chrome match pattern 不支持部分通配，宽匹配后在 main 里按域名分流：
  //   detail.1688.com          → 跳过（win-content 负责）
  //   s./search./www.1688.com  → 列表页注入（原有 DOM 选择器规则）
  //   其余 *.1688.com 子域名    → 供应商店铺页：读取 box-scan.content.js（主世界）标记的
  //                              data-alocs-offer-id 卡片，挂载 UI（React fiber 只在主世界可见）
  // 店铺二级域名不固定（shop*** 前缀 / 自定义名如 szkean、seliya），已实测 8 家店铺通用，
  // 因此不能按 "shop 前缀" 判断，只能排除法
  matches: ['*://*.1688.com/*'],

  main() {
    const host = location.hostname
    console.log(`[box] content script 启动 — host: ${host}, path: ${location.pathname}`)

    if (host === DETAIL_HOST) {
      console.log('[box] detail.1688.com 详情页，由 win-content 处理，box 跳过')
      return
    }
    const isListHost = LIST_HOSTS.includes(host)
    console.log(`[box] 分流结果: ${isListHost ? '列表页流程' : '供应商店铺页流程'}`)

    // 扫描轮次计数（MutationObserver 每轮 +1，用于日志）
    let scanCount = 0

    // ── 检查登录状态 ──
    async function checkLogin() {
      const stored = await browser.storage.local.get(['token'])
      return !!stored.token
    }

    async function showLoginTip() {
      const loggedIn = await checkLogin()
      if (!loggedIn) {
        console.warn('[box] 未登录 → 显示登录提示条')
        // 未登录，显示提示条
        if (document.getElementById('__1688_login_tip__')) return true
        const bar = document.createElement('div')
        bar.id = '__1688_login_tip__'
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff3cd;color:#856404;text-align:center;padding:8px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Arial,sans-serif;border-bottom:1px solid #ffc107;'
        bar.textContent = '⚠ 请先点击浏览器右上角的 1688 助手图标登录'
        document.body.prepend(bar)
        return true
      }
      return false
    }

    const pinia = createPinia()

    // ── Toast 提示 ──
    function showToast(msg) {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:#c9975c;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.3s;pointer-events:none;'
      el.textContent = msg
      document.body.appendChild(el)
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300) }, 2000)
    }

    // 共享的批量数据缓存
    const batchCache = reactive({})

    // ── 批量请求（指纹去重：同一次页面会话内相同的 offer_ids 集合不重复请求）──
    // 每次页面加载/翻页新看到的商品都会发起真实查询，后端逐次 +1 被查询次数
    let lastRequestFingerprint = ''

    async function requestBatch(offerIds, tag) {
      if (offerIds.length === 0) {
        console.log(`[box:${tag}] 批量查询跳过：无 offer_id`)
        return
      }

      // 会话内去重：本页面会话已查过的商品不再重复查询/计数，
      // 避免下拉加载新商品时，把页面上之前查过的旧商品再次 +1
      const newIds = offerIds.filter(id => !(id in batchCache))
      if (newIds.length === 0) {
        console.log(`[box:${tag}] 批量查询跳过：${offerIds.length} 个商品本次会话都已查询过`)
        return
      }
      console.log(`[box:${tag}] 收到 ${offerIds.length} 个 offer_id，其中新商品 ${newIds.length} 个需要查询`)

      const fingerprint = [...newIds].sort().join(',')
      if (fingerprint === lastRequestFingerprint) {
        console.log(`[box:${tag}] 批量查询跳过：新商品集合与上次相同（${newIds.length} 个），防止重复请求`)
        return
      }
      lastRequestFingerprint = fingerprint

      try {
        const stored = await browser.storage.local.get(['token', 'serverAddress'])
        if (!stored.token) {
          console.warn(`[box:${tag}] 批量查询中止：未登录（无 token）`)
          return
        }
        if (!stored.serverAddress) {
          console.warn(`[box:${tag}] 批量查询中止：未配置服务器地址`)
          return
        }

        const url = `${stored.serverAddress}/api/v1/products/batch_info`
        console.log(`[box:${tag}] 批量查询 → POST ${url}，offer_ids(${newIds.length}):`, newIds.slice(0, 10), newIds.length > 10 ? '...' : '')

        // 通过 background 代理请求（绕过混合内容限制）
        const response = await browser.runtime.sendMessage({
          type: 'api-request',
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${stored.token}`
          },
          body: JSON.stringify({ offer_ids: newIds })
        })

        if (response?.ok && response.data?.code === 200) {
          Object.assign(batchCache, response.data.data)
          const count = Object.keys(response.data.data).length
          console.log(`[box:${tag}] 批量查询成功：命中 ${count} 个商品数据（本次查询已计入被查询次数）`)
          if (count > 0) showToast(`已加载 ${count} 个商品数据`)
        } else {
          // 查询失败时重置指纹，允许下次重试
          lastRequestFingerprint = ''
          console.error(`[box:${tag}] 批量查询失败：`, { ok: response?.ok, status: response?.status, code: response?.data?.code, message: response?.data?.message })
        }
      } catch (e) {
        lastRequestFingerprint = ''
        console.error(`[box:${tag}] 批量查询异常:`, e)
      }
    }

    // ── 挂载卡片 UI ──
    // opts.keepWrapper: 保留 wrapper 容器不挪动（店铺页用，配合 wrapperClass 做「已挂载」标记，
    //                   检查+挂载全程同步，杜绝多轮触发并发导致的重复挂载）
    function mountCard(item, offerId, opts = {}) {
      const container = document.createElement('div')
      if (opts.wrapperClass) container.className = opts.wrapperClass
      item.appendChild(container)
      const app = createApp(App, {
        parentEl: item,
        offerId,
        batchCache
      })
      app.use(pinia)
      app.mount(container)

      if (opts.keepWrapper) return

      requestAnimationFrame(() => {
        if (!container.isConnected) return
        const parent = container.parentNode
        while (container.firstChild) {
          parent.insertBefore(container.firstChild, container)
        }
        parent.removeChild(container)
      })
    }

    // ════════════════════════════════════════════════
    // A. 搜索/货源/首页列表页（s.1688.com 等，原逻辑）
    // ════════════════════════════════════════════════

    // 渲染配置
    // parent: 外层容器选择器
    // child:  要插入组件的子元素选择器（相对于 parent）
    // 组件会注入到每个 parent 下的 child 里面
    const renderConfigs = [
      { parent: '.feeds-wrapper', child: '> a' },
      { parent: '[class*="offerListLayoutWrapper"]', child: '[class*="searchOfferWrapper"]' },
      // 首页推荐/精选货源：卡片本身是 .offer-card-container，offerId 在 data-aplus-report 属性里
      { parent: '.swiper-slide .list-padding', child: '.offer-card-container' },
    ]

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

    async function loadBatchData(configs) {
      const cfgs = configs || renderConfigs
      const allCards = cfgs.flatMap(cfg =>
        Array.from(document.querySelectorAll(`${cfg.parent} ${cfg.child}`))
      )
      const offerIds = new Set()

      allCards.forEach(card => {
        const id = extractOfferId(card)
        if (id) offerIds.add(id)
      })

      console.log(`[box:list] 列表页扫到 ${allCards.length} 张卡片，去重后 ${offerIds.size} 个 offer_id`)
      await requestBatch([...offerIds], 'list')
    }

    const render = (parentSelector, childSelector) => {
      const selector = `${parentSelector} ${childSelector}`
      let mounted = 0
      document.querySelectorAll(selector).forEach((item) => {
        if (item.dataset.rendered) return
        item.dataset.rendered = 'true'

        const offerId = extractOfferId(item)
        console.log(`[box:list] 挂载卡片: offerId=${offerId || '未识别'}`)
        mountCard(item, offerId)
        mounted++
      })
      return mounted
    }

    const renderAll = async () => {
      const needLogin = await showLoginTip()
      if (needLogin) return

      // 读取渲染开关，动态构建配置
      let cfgs = renderConfigs
      try {
        const stored = await browser.storage.local.get('appSettings')
        const s = stored.appSettings || {}
        cfgs = [
          s.enableSearchList !== false ? renderConfigs[0] : null,
          s.enableOfferList !== false ? renderConfigs[1] : null,
          s.enableHomeRecommend !== false ? renderConfigs[2] : null,
        ].filter(Boolean)
        console.log(`[box:list] 渲染开关: search=${s.enableSearchList !== false}, offerList=${s.enableOfferList !== false}, home=${s.enableHomeRecommend !== false} → 生效配置 ${cfgs.map(c => c.parent).join(' / ') || '无'}`)
      } catch (e) {
        console.error('[box:list] 读取设置失败:', e)
      }

      if (cfgs.length === 0) return
      loadBatchData(cfgs)
      let mounted = 0
      cfgs.forEach(cfg => { mounted += render(cfg.parent, cfg.child) })
      if (mounted > 0) console.log(`[box:list] 本轮新挂载 ${mounted} 张卡片`)
    }

    // ════════════════════════════════════════════════
    // B. 供应商店铺页（shop 前缀 / 自定义名的 *.1688.com 子域名，首页 + offerlist）
    // ════════════════════════════════════════════════
    // 店铺页为 React(xstore/winport) 渲染：卡片无 class、无 <a> 链接、offer_id 不在 DOM 属性里。
    // React fiber 内部属性只有页面主世界可见，隔离世界（本脚本）读不到，
    // 因此扫描由 box-scan.content.js（world: 'MAIN'）完成：
    //   它把 offer_id 标记到卡片根的 data-alocs-offer-id 属性上，并广播 alocs-cards-marked 事件；
    //   本脚本读取标记元素，请求批量数据并挂载 UI。

    // 主世界扫描器标记新卡片后的事件
    document.addEventListener('alocs-cards-marked', () => {
      renderShopCards()
    })

    async function renderShopCards() {
      const needLogin = await showLoginTip()
      if (needLogin) return

      scanCount++

      // 店铺页渲染开关
      try {
        const stored = await browser.storage.local.get('appSettings')
        if (stored.appSettings?.enableShopPage === false) {
          if (scanCount === 1) console.log('[box:shop] 店铺页渲染已被设置关闭（enableShopPage=false），不注入')
          return
        }
      } catch (e) {
        console.error('[box:shop] 读取设置失败:', e)
      }

      // 读取主世界扫描器标记的卡片根元素，逐个原子挂载：
      // 「检查是否已挂载」与「挂载」之间不能有任何 await/异步空隙，
      // 否则事件、MutationObserver、初始调用并发触发时会在空隙内重复挂载（一张卡出现多个信息条）。
      // 防重标记是稳定的 wrapper 容器 .alocs-shop-mount（box/App.vue 的 .box-card 在它里面）：
      // React 重渲染若清掉卡片子节点，wrapper 会消失，之后会自动重新挂载。
      const markedEls = document.querySelectorAll('[data-alocs-offer-id]')
      let mounted = 0
      const mountedOffers = []
      for (const el of markedEls) {
        if (el.querySelector(':scope > .alocs-shop-mount')) continue
        const offerId = el.getAttribute('data-alocs-offer-id')
        mountCard(el, offerId, { keepWrapper: true, wrapperClass: 'alocs-shop-mount' })
        mountedOffers.push(offerId)
        mounted++
      }

      if (mounted > 0) {
        console.log(`[box:shop] 第${scanCount}轮: 主世界已标记 ${markedEls.length} 张，本轮挂载 ${mounted} 张`)
        requestBatch(mountedOffers, 'shop')
      } else if (scanCount === 1) {
        console.log(`[box:shop] 第1轮: 主世界已标记卡片 ${markedEls.length} 张，无需挂载`)
      }
    }

    // ── 启动 ──
    if (isListHost) {
      console.log('[box] 列表页流程启动（renderAll + MutationObserver）')
      renderAll()
      new MutationObserver(() => setTimeout(renderAll, 100))
        .observe(document.body, { childList: true, subtree: true })
    } else {
      console.log('[box] 店铺页流程启动（依赖 box-scan 主世界扫描器）')
      renderShopCards()
      new MutationObserver(() => setTimeout(renderShopCards, 100))
        .observe(document.body, { childList: true, subtree: true })
    }
  },
})
