// box-content.content.js — 单机版：商品卡片注入（数据全部来自本地 IndexedDB）
import { createApp, reactive } from 'vue'
import { createPinia } from 'pinia'
import App from '../entrypoints/box/App.vue'
import { api as dataApi } from '../utils/dataClient.js'

// 列表页域名：搜索结果 / 货源列表 / 首页 / 以图搜图
const LIST_HOSTS = ['s.1688.com', 'search.1688.com', 'www.1688.com', 'air.1688.com']
// 详情页由 win-content.content.js 负责，box 不参与
const DETAIL_HOST = 'detail.1688.com'

// 非店铺子域名：指向这些 host 的链接不是供应商名
const NON_SHOP_HOSTS = new Set(['www', 's', 'search', 'detail', 'air', 'r', 'login', 'work', 'page', 'open', '114', 'kj', 'sale', 'mall'])

// ── 列表页：从卡片 DOM 权威提取供应商名（精确文本，不做模糊猜测）──
function extractSupplierName(card) {
  // 以图搜图卡片：div[class*="shopName"]
  const shopNameEl = card.querySelector('[class*="shopName--"], [class*="shopName"]')
  if (shopNameEl) {
    const t = shopNameEl.textContent.trim()
    if (t && t.length <= 40) return t
  }
  // 搜索页卡片：a.offer-desc-item 中指向店铺子域名的链接
  for (const a of card.querySelectorAll('a.offer-desc-item')) {
    const m = (a.getAttribute('href') || '').match(/^https?:\/\/([a-z0-9-]+)\.1688\.com/i)
    if (m && !NON_SHOP_HOSTS.has(m[1].toLowerCase())) {
      const t = a.textContent.trim()
      if (t && t.length <= 40) return t
    }
  }
  return ''
}

// ── 店铺页：整页一个供应商，取头部公司名 ──
function getPageSupplierName() {
  let fallback = ''
  for (const el of document.querySelectorAll('.hover-trigger')) {
    const t = el.textContent.trim()
    if (!t || t.length > 40) continue
    if (/公司|商行|工厂|厂|经营部|商贸|贸易|实业|门市|经销|批发部/.test(t)) return t
    if (!fallback && !t.startsWith('·') && t.length >= 4) fallback = t
  }
  return fallback
}

export default defineContentScript({
  // 宽匹配后按域名分流：
  //   detail.1688.com          → 跳过（win-content 负责）
  //   s./search./www./air.     → 列表页注入（DOM 选择器规则）
  //   其余 *.1688.com 子域名    → 供应商店铺页：读取 box-scan.content.js（主世界）标记的卡片
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

    let scanCount = 0
    // 已挂载但尚未随供应商名一起请求的商品（等店铺头部公司名就绪）
    const pendingShopOffers = new Set()
    const pinia = createPinia()

    // ── Toast 提示 ──
    function showToast(msg) {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:#c9975c;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.3s;pointer-events:none;'
      el.textContent = msg
      document.body.appendChild(el)
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300) }, 2000)
    }

    // 共享的本地数据缓存（offer_id → 卡片信息）
    const batchCache = reactive({})

    // box1 图表类型：line=折线图（默认）| bar=柱状图（后台设置）
    let box1ChartType = 'line'

    // ── 读取本地批量数据（IndexedDB，无网络）──
    let lastRequestFingerprint = ''

    async function requestBatch(offerIds, tag, supplierMap = {}) {
      if (offerIds.length === 0) {
        console.log(`[box:${tag}] 本地批量读取跳过：无 offer_id`)
        return
      }
      // 会话内去重：已读过的商品不再重复读
      const newIds = offerIds.filter(id => !(id in batchCache))
      if (newIds.length === 0) {
        console.log(`[box:${tag}] 本地批量读取跳过：${offerIds.length} 个商品本次会话都已读取`)
        return
      }
      console.log(`[box:${tag}] 收到 ${offerIds.length} 个 offer_id，其中新商品 ${newIds.length} 个需要读取`)

      const fingerprint = [...newIds].sort().join(',')
      if (fingerprint === lastRequestFingerprint) {
        console.log(`[box:${tag}] 本地批量读取跳过：新商品集合与上次相同`)
        return
      }
      lastRequestFingerprint = fingerprint

      // 只透传新商品的供应商名
      const newSupplierMap = {}
      for (const id of newIds) {
        const name = typeof supplierMap[id] === 'string' ? supplierMap[id].trim() : ''
        if (name) newSupplierMap[id] = name
      }

      try {
        const res = await dataApi('/api/v1/products/batch_info', 'POST', {
          offer_ids: newIds,
          supplier_map: newSupplierMap,
        })
        if (res.code === 200) {
          Object.assign(batchCache, res.data)
          const count = Object.keys(res.data).length
          console.log(`[box:${tag}] 本地数据读取成功：命中 ${count} 个商品`)
          if (count > 0) showToast(`已加载 ${count} 个商品数据`)
        } else {
          lastRequestFingerprint = ''
          console.error(`[box:${tag}] 本地数据读取失败：`, res.message)
        }
      } catch (e) {
        lastRequestFingerprint = ''
        console.error(`[box:${tag}] 本地数据读取异常:`, e)
      }
    }

    // ── 挂载卡片 UI ──
    function mountCard(item, offerId, opts = {}) {
      const container = document.createElement('div')
      if (opts.wrapperClass) container.className = opts.wrapperClass
      item.appendChild(container)
      const app = createApp(App, {
        parentEl: item,
        offerId,
        batchCache,
        chartType: box1ChartType
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
    // A. 搜索/货源/首页/以图搜图 列表页（DOM 选择器规则）
    // ════════════════════════════════════════════════
    const renderConfigs = [
      { parent: '.feeds-wrapper', child: '> a' },
      // 货源列表 / 以图搜图页（air.1688.com/kapp/1688-search/pc-image-search，卡片为 searchOfferWrapper--xxx）
      { parent: '[class*="offerListLayoutWrapper"]', child: '[class*="searchOfferWrapper"]' },
      // 首页推荐/精选货源：卡片本身是 .offer-card-container，offerId 在 data-aplus-report 属性里
      { parent: '.swiper-slide .list-padding', child: '.offer-card-container' },
    ]

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
      const supplierMap = {}

      allCards.forEach(card => {
        const id = extractOfferId(card)
        if (id) {
          offerIds.add(id)
          // 刷出卡片时即提取供应商名，与产品一一对应
          const name = extractSupplierName(card)
          if (name) supplierMap[id] = name
        }
      })

      console.log(`[box:list] 列表页扫到 ${allCards.length} 张卡片，去重后 ${offerIds.size} 个 offer_id，提取到供应商名 ${Object.keys(supplierMap).length} 个`)
      await requestBatch([...offerIds], 'list', supplierMap)
    }

    const render = (parentSelector, childSelector) => {
      const selector = `${parentSelector} ${childSelector}`
      let mounted = 0
      document.querySelectorAll(selector).forEach((item) => {
        if (item.dataset.rendered) return
        item.dataset.rendered = 'true'

        const offerId = extractOfferId(item)
        // 提取不到 offer_id 的卡片（广告位/异构卡片）不挂载
        if (!offerId) return
        try {
          console.log(`[box:list] 挂载卡片: offerId=${offerId}`)
          mountCard(item, offerId)
          mounted++
        } catch (e) {
          // 单卡挂载失败不影响其余卡片
          console.error('[box:list] 挂载失败:', offerId, e)
        }
      })
      return mounted
    }

    const renderAll = async () => {
      // 渲染开关
      let cfgs = renderConfigs
      try {
        const stored = await browser.storage.local.get('appSettings')
        const s = stored.appSettings || {}
        cfgs = [
          s.enableSearchList !== false ? renderConfigs[0] : null,
          s.enableOfferList !== false ? renderConfigs[1] : null,
          s.enableHomeRecommend !== false ? renderConfigs[2] : null,
        ].filter(Boolean)
        box1ChartType = ['bar', 'line'].includes(s.box1ChartType) ? s.box1ChartType : 'line'
        console.log(`[box:list] 渲染开关: search=${s.enableSearchList !== false}, offerList=${s.enableOfferList !== false}, home=${s.enableHomeRecommend !== false}；box1图表: ${box1ChartType}`)
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
    // B. 供应商店铺页（React fiber 扫描由 box-scan 主世界完成）
    // ════════════════════════════════════════════════
    document.addEventListener('alocs-cards-marked', () => {
      renderShopCards()
    })

    async function renderShopCards() {
      scanCount++

      try {
        const stored = await browser.storage.local.get('appSettings')
        const s = stored.appSettings || {}
        if (s.enableShopPage === false) {
          if (scanCount === 1) console.log('[box:shop] 店铺页渲染已被设置关闭（enableShopPage=false），不注入')
          return
        }
        box1ChartType = ['bar', 'line'].includes(s.box1ChartType) ? s.box1ChartType : 'line'
      } catch (e) {
        console.error('[box:shop] 读取设置失败:', e)
      }

      // 读取主世界扫描器标记的卡片根元素，逐个原子挂载
      const markedEls = document.querySelectorAll('[data-alocs-offer-id]')
      let mounted = 0
      for (const el of markedEls) {
        if (el.querySelector(':scope > .alocs-shop-mount')) continue
        const offerId = el.getAttribute('data-alocs-offer-id')
        mountCard(el, offerId, { keepWrapper: true, wrapperClass: 'alocs-shop-mount' })
        pendingShopOffers.add(offerId)
        mounted++
      }

      if (mounted > 0) {
        console.log(`[box:shop] 第${scanCount}轮: 主世界已标记 ${markedEls.length} 张，本轮挂载 ${mounted} 张`)
      } else if (scanCount === 1) {
        console.log(`[box:shop] 第1轮: 主世界已标记卡片 ${markedEls.length} 张，无需挂载`)
      }

      // 供应商名就绪后再请求，确保产品↔供应商映射随记录一起落库
      if (pendingShopOffers.size === 0) return
      const pageSupplier = getPageSupplierName()
      const offerIds = [...pendingShopOffers]
      if (pageSupplier) {
        const supplierMap = Object.fromEntries(offerIds.map(id => [id, pageSupplier]))
        pendingShopOffers.clear()
        console.log(`[box:shop] 供应商「${pageSupplier}」就绪，请求 ${offerIds.length} 个商品`)
        requestBatch(offerIds, 'shop', supplierMap)
      } else if (scanCount >= 10) {
        // 兜底：多轮仍取不到头部名，不无限期等待（无映射，计数为 0）
        pendingShopOffers.clear()
        console.log(`[box:shop] 多轮未取到供应商名，直接请求 ${offerIds.length} 个商品`)
        requestBatch(offerIds, 'shop')
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
