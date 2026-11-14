// box-content.content.js — 单机版：商品卡片注入（数据全部来自本地 IndexedDB）
import { createApp, reactive } from 'vue'
import { createPinia } from 'pinia'
import { ElNotification } from 'element-plus'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/el-notification.css'
import App from '../entrypoints/box/App.vue'
import { api as dataApi } from '../utils/dataClient.js'
import { setupIm } from '../entrypoints/im/inject.js'
import FactoryNoteCard from '../entrypoints/box/components/FactoryNoteCard.vue'

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
  // 2026-11 改版搜索页卡片：shopRow--xxx 内指向店铺子域名的链接（如 hongchuan88.1688.com）
  for (const a of card.querySelectorAll('[class*="shopRow"] a[href]')) {
    const m = (a.getAttribute('href') || '').match(/^https?:\/\/([a-z0-9-]+)\.1688\.com/i)
    if (m && !NON_SHOP_HOSTS.has(m[1].toLowerCase())) {
      const t = a.textContent.trim()
      if (t && t.length <= 40) return t
    }
  }
  // 旧版搜索页卡片：a.offer-desc-item 中指向店铺子域名的链接
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
    // 旺旺客服页（IM 聊天）不是列表页也不是店铺页：走「备注」Tab 注入流程。
    // 注意：QQ 浏览器把 manifest 注册快照锁在 Secure Preferences 里，新增 content script
    // 入口在原位覆盖更新下永不生效，因此 IM 逻辑静态并入本脚本（文件内容更新不受限）。
    // air.1688.com 在 LIST_HOSTS 里（以图搜图等列表页），但其 IM 应用路径不能走列表流程，
    // 否则 MutationObserver 空转 + 兜底扫描弹「页面改版」误报 toast
    if (location.pathname.startsWith('/app/ocms-fusion-components-1688/')) {
      console.log('[box] 旺旺客服页（IM），交给备注 Tab 注入流程')
      setupIm()
      return
    }
    // 工厂店卡片页（sale.1688.com/factory/card.html）：整页单工厂档案。
    // 进入该页 = 看过该供应商（特征商品浏览流水 + 页面商品出现流水），
    let scanCount = 0
    // 已挂载但尚未随供应商名一起请求的商品（等店铺头部公司名就绪）
    const pendingShopOffers = new Set()
    // pinia/batchCache 等必须在所有分支派发之前初始化：工厂店分支提前 return，
    // 排在 return 之后的 const 永远不会初始化（TDZ），mountCard/requestBatch 一引用就炸（历史踩坑×2）
    const pinia = createPinia()
    let pageLabel = '本页'
    const scannedOfferIds = new Set()
    const loadedOfferIds = new Set()
    const batchCache = reactive({})

    // 商品标题/图片就地回填（修复后台「未采集标题」），并挂 FactoryNoteCard 浮窗
    if (host === 'sale.1688.com' && location.pathname.startsWith('/factory/card.html')) {
      console.log('[box] 工厂店卡片页，启动采集 + 备注浮窗')
      setupFactoryCardPage()
      return
    }
    const isListHost = LIST_HOSTS.includes(host)
    // 找工厂页（s.1688.com/company/pc/factory_search.htm）：卡片结构完全不同于商品列表，
    // 必须提前分流，否则列表页流程会空转并弹「页面改版」误报
    const isFactorySearch = isListHost && /\/company\/pc\/factory_search\.htm/.test(location.pathname)
    console.log(`[box] 分流结果: ${isListHost ? '列表页流程' : '供应商店铺页流程'}${isFactorySearch ? ' → 找工厂页' : ''}`)
    pageLabel = isListHost ? '本页' : '本店'

    // ── 页面加载提示（Element Plus Notification）──
    // 每条消息独立弹出、几秒后自动消失；同时出现多条时由 Element Plus 自动向下排队。

    function ensureNotifyStyle() {
      if (document.getElementById('alocs-el-notify-style')) return
      const style = document.createElement('style')
      style.id = 'alocs-el-notify-style'
      // 把 Element Plus 默认通知压成单行小卡片（默认是 82px 高的标题+正文两行）
      style.textContent = `
.alocs-page-notify{z-index:2147483647!important;width:auto!important;min-width:200px;max-width:min(380px,calc(100vw - 24px));padding:10px 30px 10px 12px!important;border:none!important;border-radius:10px!important;background:rgba(255,255,255,.94)!important;-webkit-backdrop-filter:blur(12px) saturate(160%);backdrop-filter:blur(12px) saturate(160%);box-shadow:0 10px 28px -8px rgba(15,23,42,.22),0 2px 6px rgba(15,23,42,.06)!important}
.alocs-page-notify .el-notification__icon{width:18px!important;height:18px!important;font-size:18px!important;align-self:center}
.alocs-page-notify .el-notification__group{margin:0 0 0 8px!important;display:flex;align-items:center;min-height:18px}
.alocs-page-notify .el-notification__title{display:none!important}
.alocs-page-notify .el-notification__content{margin:0!important;font-size:13px;line-height:18px;color:#334155;white-space:pre-line}
.alocs-page-notify .el-notification__closeBtn{top:50%!important;right:10px!important;transform:translateY(-50%);font-size:13px!important}
`
      document.head.appendChild(style)
    }

    function notify(message, { type = 'success', duration = 3000 } = {}) {
      ensureNotifyStyle()
      ElNotification({
        title: 'ALOCS 1688',
        message,
        type,
        duration,
        position: 'top-right',
        offset: 12,
        customClass: 'alocs-page-notify',
      })
    }

    // 共享的本地数据缓存（offer_id → 卡片信息）—— 已提升到 main() 顶部（工厂店分支提前 return，见顶部注释）

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
      for (const id of newIds) scannedOfferIds.add(id)
      // 只在页面首次读取时提示「正在读取」，后续滚动加载只提示结果，避免刷屏
      if (loadedOfferIds.size === 0) {
        notify(`正在读取${pageLabel}商品数据…`, { type: 'info', duration: 2000 })
      }

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
          for (const id of Object.keys(res.data)) loadedOfferIds.add(id)
          console.log(`[box:${tag}] 本地数据读取成功：命中 ${count} 个商品`)
          if (count > 0) {
            notify(`已加载 ${loadedOfferIds.size} 个商品数据（${pageLabel} ${scannedOfferIds.size} 个商品）`)
          }
        } else {
          lastRequestFingerprint = ''
          console.error(`[box:${tag}] 本地数据读取失败：`, res.message)
          notify(`读取商品数据失败：${res.message || '未知错误'}`, { type: 'error', duration: 4000 })
        }
      } catch (e) {
        lastRequestFingerprint = ''
        console.error(`[box:${tag}] 本地数据读取异常:`, e)
        notify(`读取商品数据失败：${e.message || e}`, { type: 'error', duration: 4000 })
      }
    }

    // ── 挂载卡片 UI ──
    // 同一个容器里出现多套 box（多规则命中 / 历史挂载残留）时，只保留第一套
    function dedupeBoxes(root) {
      const runs = []
      let cur = null
      for (const child of [...root.children]) {
        if (child.classList && child.classList.contains('box-card')) {
          if (!cur) { cur = []; runs.push(cur) }
          cur.push(child)
        } else {
          cur = null
        }
      }
      if (runs.length > 1) {
        runs.slice(1).forEach(run => run.forEach(n => n.remove()))
      }
      // 卡片内容里残留的 box（旧规则把 box 挂进了卡片内部）：根下已有正确挂载时清掉
      if (runs.length >= 1) {
        const keep = runs[0][0]
        root.querySelectorAll('.box-card').forEach(n => {
          if (n === keep || keep.contains(n)) return
          const p = n.parentElement
          if (p && p !== root && !p.closest('.box-card')) n.remove()
        })
      }
    }

    function mountCard(item, offerId, opts = {}) {
      // mountTarget：容器实际追加位置。新版搜索页卡片 a.offerCard--xxx 是固定高度，
      // box 必须挂到外层 gridCell--xxx 容器才能正常撑开布局（已在真实页面验证）
      const mountTarget = opts.mountTarget || item
      dedupeBoxes(mountTarget)
      // 已有 box 就不再挂（防止多规则重复命中）
      if (mountTarget.querySelector('.box-main-card')) return false
      const container = document.createElement('div')
      container.setAttribute('data-alocs-box', '1')
      if (opts.wrapperClass) container.className = opts.wrapperClass
      if (opts.mountTarget) container.style.marginTop = '4px'
      mountTarget.appendChild(container)
      const app = createApp(App, {
        parentEl: opts.parentEl || item,
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
    // A. 搜索/货源/首页/以图搜图 列表页（DOM 选择器规则）
    // ════════════════════════════════════════════════
    const renderConfigs = [
      // 旧版搜索页瀑布流（部分用户仍命中）
      { key: 'search', parent: '.feeds-wrapper', child: '> a' },
      // 2026-11 改版搜索页：list.offerList--xxx > cell.gridCell--xxx > (a.offerCard--xxx | div.ad-offer)
      // 以 gridCell 为挂载单元：普通卡与广告位（div.ad-offer）共用同一个格子容器，
      // 一并覆盖；卡片固定高度，box 挂在格子里才能撑开布局不遮挡
      { key: 'search', parent: '[class*="offerList--"]', child: '[class*="gridCell--"]', mountSelf: true },
      // 货源列表 / 以图搜图页（air.1688.com/kapp/1688-search/pc-image-search，卡片为 searchOfferWrapper--xxx）
      { key: 'offerList', parent: '[class*="offerListLayoutWrapper"]', child: '[class*="searchOfferWrapper"]' },
      // 首页推荐/精选货源：卡片本身是 .offer-card-container，offerId 在 data-aplus-report 属性里
      { key: 'home', parent: '.swiper-slide .list-padding', child: '.offer-card-container' },
    ]

    // offer_id 提取：读埋点属性优先，其次链接参数。
    // 1688 的 data-aplus-report 是「^」分隔的埋点串，可用字段：
    //   item_id@商品ID（搜索卡 / P4P 广告 / 右侧广告位都有）
    //   offerId@商品ID（右侧广告位 right_offer）
    //   object_id@商品ID + object_type@offer（P4P 广告）
    // 注意 data-key-value="offer_xxx" 不是商品 ID，不能读
    function readOfferIdFromNode(node) {
      if (!node || !node.getAttribute) return ''
      const href = node.getAttribute('href') || ''
      const renderkey = node.getAttribute('data-renderkey') || ''
      const aplus = node.getAttribute('data-aplus-report') || ''
      return (
        renderkey.match(/_(\d+)$/)?.[1] ||
        aplus.match(/item_id@(\d+)/)?.[1] ||
        aplus.match(/offerId@(\d+)/)?.[1] ||
        (/(?:\^|^)object_type@(?:offer|right_offer)/.test(aplus) ? aplus.match(/object_id@(\d+)/)?.[1] : '') ||
        href.match(/offerId=(\d+)/)?.[1] ||
        (node.href || '').match(/offerId=(\d+)/)?.[1] ||
        ''
      )
    }

    function extractOfferId(el) {
      // 1) 元素自身（卡片锚点 / 广告位锚点）
      const own = readOfferIdFromNode(el)
      if (own) return own
      // 2) 内部节点：以 gridCell 为单元时，卡片与广告位都在里面
      for (const node of el.querySelectorAll('[data-renderkey], [data-aplus-report], a[href*="offerId="]')) {
        const id = readOfferIdFromNode(node)
        if (id) return id
      }
      return ''
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

    const render = (cfg) => {
      const selector = `${cfg.parent} ${cfg.child}`
      const nodes = document.querySelectorAll(selector)
      let mounted = 0
      let matched = nodes.length
      nodes.forEach((item) => {
        const offerId = extractOfferId(item)
        // 提取不到 offer_id 的格子（空位/纯图片广告）不挂载
        if (!offerId) return

        if (item.dataset.rendered) {
          // 广告位会轮播换品：格子没变但商品换了 → 拆掉旧 box 重挂
          if (item.dataset.boxOfferId && item.dataset.boxOfferId !== offerId) {
            // 挂载后包装容器已被拆掉，box 是格子的直接子节点，按类名整体清除
            item.querySelectorAll('.box-card').forEach(n => n.remove())
            delete item.dataset.rendered
          } else {
            dedupeBoxes(item)
            return
          }
        } else if (item.querySelector('.box-main-card')) {
          // 已由其它规则挂过，避免重复
          dedupeBoxes(item)
          item.dataset.rendered = 'true'
          item.dataset.boxOfferId = offerId
          return
        }

        item.dataset.rendered = 'true'
        item.dataset.boxOfferId = offerId
        try {
          console.log(`[box:list] 挂载卡片: offerId=${offerId}`)
          const opts = {}
          if (cfg.mountSelf) {
            // 以格子为单元：普通卡与广告位都挂进格子本身
            opts.mountTarget = item
            opts.parentEl = item
          } else if (cfg.mountIntoCell && item.parentElement) {
            opts.mountTarget = item.parentElement
            opts.parentEl = item.parentElement
          }
          const ok = mountCard(item, offerId, opts)
          if (ok !== false) mounted++
        } catch (e) {
          // 单卡挂载失败不影响其余卡片
          console.error('[box:list] 挂载失败:', offerId, e)
        }
      })
      return { mounted, matched }
    }

    // ── 通用兜底：1688 改版会整体更换 CSS class（带构建 hash），但埋点属性全站统一且稳定 ──
    // data-renderkey（…_商品ID 结尾）/ data-aplus-report（object_id@商品ID）/ a[href*="offerId="]
    // 是阿里统一埋点体系的属性，历史多次改版均未变动，作为常规规则全部失效时的自动接管。
    function genericFindCards() {
      const seen = new Set()
      const cards = []
      for (const el of document.querySelectorAll('[data-renderkey], a[href*="offerId="], [data-aplus-report*="item_id@"]')) {
        const id = extractOfferId(el)
        if (!id || seen.has(id)) continue
        // 只取最外层卡片根：祖先已入选的嵌套元素跳过，避免重复挂载
        if (cards.some(c => c.contains(el))) continue
        seen.add(id)
        cards.push(el)
      }
      return cards
    }

    function renderGeneric() {
      const cards = genericFindCards()
      console.log(`[box:list] 常规规则未命中，埋点属性兜底扫描到 ${cards.length} 张卡片`)
      let mounted = 0
      for (const el of cards) {
        if (el.dataset.rendered) continue
        const offerId = extractOfferId(el)
        if (!offerId) continue
        // 所在格子已有 box（常规规则已挂过）就跳过，防止重复
        const cell = el.closest('[class*="gridCell--"]')
        if (cell && cell.querySelector('.box-main-card')) continue
        try {
          // <a> 卡片挂到外层容器（新版卡片多为固定高度，挂进去会溢出遮挡），其余挂自身
          const target = (el.tagName === 'A' && el.parentElement) ? el.parentElement : el
          const opts = target === el ? {} : { mountTarget: target, parentEl: target }
          el.dataset.rendered = 'true'
          const ok = mountCard(el, offerId, opts)
          if (ok !== false) mounted++
        } catch (e) {
          console.error('[box:list] 兜底挂载失败:', offerId, e)
        }
      }
      return mounted
    }

    const renderAll = async () => {
      // 渲染开关（按 key 分组：search/offerList/home）
      let cfgs = renderConfigs
      try {
        const stored = await browser.storage.local.get('appSettings')
        const s = stored.appSettings || {}
        const flags = {
          search: s.enableSearchList !== false,
          offerList: s.enableOfferList !== false,
          home: s.enableHomeRecommend !== false,
        }
        cfgs = renderConfigs.filter(cfg => flags[cfg.key])
        console.log(`[box:list] 渲染开关: search=${flags.search}, offerList=${flags.offerList}, home=${flags.home}`)
      } catch (e) {
        console.error('[box:list] 读取设置失败:', e)
      }

      if (cfgs.length === 0) return
      loadBatchData(cfgs)
      let mounted = 0
      let matched = 0
      cfgs.forEach(cfg => {
        const r = render(cfg)
        mounted += r.mounted
        matched += r.matched
      })
      // 常规规则在页面上一个卡片都没匹配到（通常是 1688 改版换了 class）→ 埋点属性兜底扫描
      if (matched === 0) {
        mounted += renderGeneric()
      }
      if (mounted > 0) {
        console.log(`[box:list] 本轮新挂载 ${mounted} 张卡片`)
      } else if (matched === 0 && !adaptWarned) {
        adaptWarned = true
        notify('1688 页面结构疑似改版，box 未能挂载，请反馈更新插件', { type: 'warning', duration: 6000 })
        console.error('[box:list] ⚠️ 1688 页面结构疑似改版：常规规则与埋点兜底均未找到商品卡片，box 适配失效')
      }
    }
    let adaptWarned = false

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

    // ════════════════════════════════════════════════
    // B2. 工厂店卡片页（sale.1688.com/factory/card.html）
    // ════════════════════════════════════════════════
    // 整页单工厂档案：进入 = 看过该供应商。做三件事：
    //   ① 采集页面上全部商品（标题/图/offer）→ /suppliers/visit_records 补全 products（修「未采集标题」）
    //   ② URL topOfferIds 记浏览流水、页面商品记出现流水（供应商由此进入「已看」统计）
    //   ③ 右下角挂 FactoryNoteCard 浮窗（备注/趋势同款组件，数据与找工厂卡同一接口）
    // 调试探针：隔离世界的报错/里程碑写进隐藏 DOM 节点，主世界（DevTools/eval）可读
    function fcDebugLog(msg) {
      try {
        let el = document.getElementById('alocs-fc-debug')
        if (!el) {
          el = document.createElement('div')
          el.id = 'alocs-fc-debug'
          el.style.display = 'none'
          document.documentElement.appendChild(el)
        }
        el.textContent = (el.textContent + '\n' + msg).slice(-4000)
      } catch {}
    }
    function setupFactoryCardPage() {
      // 构建标记：写进共享 DOM 属性，主世界（DevTools/eval）可读，用于确认页面跑的是哪一版
      try { document.documentElement.setAttribute('data-alocs-fc-build', 'D4-1114') } catch {}
      const qs = new URLSearchParams(location.search)
      const memberId = qs.get('memberId') || ''
      const topOfferIds = (qs.get('topOfferIds') || '').split(',').map(s => s.trim()).filter(Boolean)
      // 注意：本分支在 main() 里早于页面级 pinia 定义就被调用，这里必须自建实例
      // （复用页面级 pinia 会触发暂时性死区 ReferenceError，整条工厂店流程静默崩掉）
      const fcPinia = createPinia()

      // 工厂名：document.title 形如「厂名-企业信息查询黄页-阿里巴巴」
      function factoryName() {
        const t = (document.title || '').split('-')[0].trim()
        return t && !/企业信息查询|阿里巴巴/.test(t) ? t : ''
      }

      // 页面商品：全部 detail.1688.com/offer/:id 链接。
      // 标题取链接文本里第一条「非价格/营销噪音」的行（价格行、已售/想定/起订等行都排除）
      const FC_NOISE = /(已售|人想定|起订|立即定制|包赔|必赔|趋势热品|工厂店|查看更多)/
      function collectProducts() {
        const out = new Map()
        document.querySelectorAll('a[href*="detail.1688.com/offer/"]').forEach(a => {
          const m = (a.getAttribute('href') || '').match(/offer\/(\d{6,})/)
          if (!m || out.has(m[1])) return
          const oid = m[1]
          const lines = (a.textContent || '').split('\n').map(s => s.trim()).filter(Boolean)
          let title = ''
          for (const line of lines) {
            if (line.length < 2 || FC_NOISE.test(line)) continue
            if (/^[¥￥\d]/.test(line)) continue
            title = line; break
          }
          if (!title) { // 兜底：取最长一行
            for (const line of lines) if (line.length > title.length && !/^[¥￥]/.test(line)) title = line
          }
          if (!title) return
          let img = ''
          const bgm = (a.style.backgroundImage || '').match(/url\((['"]?)(.*?)\1\)/)
          if (bgm && bgm[2]) img = bgm[2]
          else {
            const im = a.querySelector('img')
            img = im ? (im.src || im.getAttribute('data-src') || '') : ''
          }
          out.set(oid, { offer_id: oid, title, main_img_url: img })
        })
        return out
      }

      async function recordVisit(name, prods) {
        const allIds = [...prods.keys()]
        // 特征商品（URL topOfferIds）记「浏览」；没有时取页面前 3 个，保证供应商进入「已看」
        const viewIds = topOfferIds.length ? topOfferIds : allIds.slice(0, 3)
        try {
          const res = await dataApi('/api/v1/suppliers/visit_records', 'POST', {
            supplier_name: name,
            memberId,
            products: [...prods.values()],
            view_offer_ids: viewIds,
          })
          if (res.code === 200) console.log(`[box:factorycard] 到访已记录：${name}（商品 ${allIds.length}，浏览 ${res.data?.viewed ?? 0}）`)
          else console.error('[box:factorycard] 到访记录失败:', res.message)
        } catch (e) {
          console.error('[box:factorycard] 到访记录异常:', e)
        }
      }

      // 批量读取备注数据并挂载 FactoryNoteCard（右下浮窗与相似工厂卡共用）
      function mountNoteApp(el, name, mid, offerId) {
        const note = reactive({})
        async function fetchNote() {
          const r = await dataApi('/api/v1/suppliers/batch_info', 'POST', {
            names: [name],
            memberIds: mid ? { [name]: mid } : {},
            offerIds: offerId ? { [name]: offerId } : {},
          })
          if (r.code === 200 && r.data?.[name]) Object.assign(note, r.data[name])
        }
        fetchNote().catch(e => console.error('[box:factorycard] 备注数据读取失败:', e))
        const app = createApp(FactoryNoteCard, { factoryName: name, memberId: mid, offerId, note, reload: fetchNote })
        app.use(fcPinia)
        app.mount(el)
      }

      // 右下角备注浮窗：数据与找工厂卡同一 /suppliers/batch_info
      let panelShown = false
      async function mountNotePanel(name) {
        if (panelShown) return
        panelShown = true
        if (!document.getElementById('alocs-fc-style')) {
          const style = document.createElement('style')
          style.id = 'alocs-fc-style'
          style.textContent = `
            .alocs-fc-panel { position: fixed; right: 12px; bottom: 16px; width: 440px; height: 320px;
              z-index: 2147483000; background: #fff; border: 1px solid #f0e6d6; border-radius: 8px;
              box-shadow: 0 8px 28px rgba(0,0,0,0.16); display: flex; flex-direction: column;
              padding: 8px 10px 0 12px; box-sizing: border-box; }
            .alocs-fc-bar { display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-bottom: 4px; }
            .alocs-fc-bar .t { font-size: 11px; font-weight: 600; color: #c9975c; }
            .alocs-fc-bar .sp { flex: 1; }
            .alocs-fc-bar button { border: none; background: transparent; color: #999; font-size: 12px;
              cursor: pointer; width: 22px; height: 22px; border-radius: 4px; display: flex;
              align-items: center; justify-content: center; padding: 0; }
            .alocs-fc-bar button:hover { background: #f5f5f5; color: #333; }
            /* 相似工厂卡重构：左图格（主图+缩略图 2×2，同找工厂页） */
            .alocs-sim-imgs { width:170px; flex-shrink:0; display:flex; flex-wrap:wrap; gap:6px; align-content:flex-start; }
            .alocs-sim-th { width:82px; height:82px; border-radius:4px; background-color:#f0f0f0;
              background-size:cover; background-position:center; }
            /* 相似工厂卡内的备注组件：flex 第三列（缩到 300px 给中列让位） */
            .alocs-sim-mount { flex: 0 0 300px; height: 170px; margin-left: 12px; padding: 6px 8px 0 12px;
              border-left: 1px solid #f0e6d6; box-sizing: border-box; display: flex; background: #fff; }
            /* 广告卡等非 flex 结构：卡内绝对定位面板 */
            .alocs-sim-mount-abs { position: absolute; right: 10px; top: 20px; bottom: 20px; width: 300px; margin-left: 0; }
          `
          document.head.appendChild(style)
        }
        const panel = document.createElement('div')
        panel.className = 'alocs-fc-panel'
        const bar = document.createElement('div')
        bar.className = 'alocs-fc-bar'
        bar.innerHTML = '<span class="t">ALOCS 备注</span><span class="sp"></span>'
        const minBtn = document.createElement('button')
        minBtn.textContent = '—'
        minBtn.title = '收起 / 展开'
        bar.appendChild(minBtn)
        const body = document.createElement('div')
        body.style.cssText = 'flex:1 1 auto; min-height:0; display:flex;'
        panel.appendChild(bar)
        panel.appendChild(body)
        document.body.appendChild(panel)
        minBtn.addEventListener('click', () => {
          const min = panel.classList.toggle('alocs-fc-min')
          body.style.display = min ? 'none' : 'flex'
          minBtn.textContent = min ? '+' : '—'
        })

        const mount = document.createElement('div')
        mount.style.cssText = 'flex:1 1 auto; min-width:0; display:flex;'
        body.appendChild(mount)
        mountNoteApp(mount, name, memberId, topOfferIds[0] || '')
      }

      // ── 相似工厂推荐卡（「为你推荐相似工厂」区块）：
      //    普通卡 = <a href="factory/card.html?memberId=..&topOfferIds=..">（flex 行：主图 170 + 信息 580），
      //    广告卡 = 链接不是 factory/card.html（第一张，布局略异）。统一重构成找工厂页同款三栏：
      //    左「主图+商品缩略图 2×2」｜中「压缩后的工厂信息」｜右「FactoryNoteCard 备注/趋势」
      //    注入时拦点击冒泡，防止点组件误触卡片跳转 ──
      const simMounted = new WeakSet()
      function scanSimilarFactories() {
        // 定位推荐区容器：从标题向上自适应爬（层级随页面版本变化，写死层数会漏）
        const heading = [...document.querySelectorAll('*')].find(el =>
          el.children.length === 0 && (el.textContent || '').trim() === '为你推荐相似工厂')
        if (!heading) return
        let section = heading
        for (let i = 0; i < 8 && section; i++) {
          section = section.parentElement
          if (!section) break
          if (section.querySelectorAll('a[href*="factory/card.html?memberId="], a[href*="detail.1688.com/offer/"]').length >= 3) break
        }
        if (!section) return
        section.querySelectorAll(':scope > div > div, :scope > div').forEach(wrap => {
          const h = wrap.getBoundingClientRect().height
          if (h < 150 || h > 500) return // 太矮=标题行，太高=整列表容器
          const root = wrap.tagName === 'A' ? wrap : (wrap.querySelector(':scope > a') || wrap)
          // DOM 自愈式幂等：React 重渲染会抹掉注入节点——
          // mount + 图格都在 = 完好跳过；只剩 mount（图格被抹）= 只补图格；都没有 = 全新挂载
          const hasMount = wrap.querySelector('.alocs-sim-mount, .alocs-sim-mount-abs')
          const hasGrid = wrap.querySelector('.alocs-sim-imgs')
          if (hasMount && hasGrid) { simMounted.add(wrap); return }
          // 工厂名：优先加粗名字节点，兜底取以公司/厂等结尾的长文本叶子
          const nameEl = root.querySelector('div[style*="font-weight: bold"], div[style*="font-weight:bold"]')
            || [...root.querySelectorAll('div')].find(el => el.children.length === 0
              && (el.textContent || '').trim().length >= 6
              && /(有限公司|有限责任公司|厂|经营部|商行|公司)$/.test((el.textContent || '').trim()))
          const name = nameEl ? nameEl.textContent.trim() : ''
          if (!name) return
          try {
            // 重构（返回 false = 主图懒加载未完成，本轮跳过，等重扫）
            const ready = restructureSimCard(root)
            if (ready === false) return
            simMounted.add(wrap)
            if (hasMount) return // mount 还在，本轮只补了图格
            // memberId / topOfferIds：卡片主链接；广告卡没有 → 代表商品兜底用卡内商品链接
            const cardLink = root.matches('a[href*="factory/card.html?memberId="]')
              ? root : root.querySelector('a[href*="factory/card.html?memberId="]')
            const mid = cardLink ? decodeURIComponent((cardLink.getAttribute('href').match(/memberId=([^&]+)/) || [])[1] || '') : ''
            const topIds = cardLink ? (((cardLink.getAttribute('href').match(/topOfferIds=([^&]+)/) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean)) : []
            const repOffer = topIds[0]
              || ((root.querySelector('a[href*="detail.1688.com/offer/"]')?.getAttribute('href') || '').match(/offer\/(\d{6,})/) || [])[1]
              || ''
            const mount = document.createElement('div')
            ;['click', 'mousedown', 'mouseup'].forEach(ev =>
              mount.addEventListener(ev, e => e.stopPropagation()))
            const flexHost = root.tagName === 'A' ? root : (root.querySelector('a') || root)
            if (flexHost !== root && getComputedStyle(flexHost).display.includes('flex')) {
              mount.className = 'alocs-sim-mount'
              flexHost.appendChild(mount)
            } else if (flexHost !== root) {
              // 广告卡等非 flex 结构：卡内绝对定位面板（信息列收窄让位）
              mount.className = 'alocs-sim-mount alocs-sim-mount-abs'
              root.appendChild(mount)
            } else {
              mount.className = 'alocs-sim-mount'
              root.appendChild(mount)
            }
            mountNoteApp(mount, name, mid, repOffer)
          } catch (e) {
            console.error('[box:factorycard] 单卡注入失败:', name, e)
            fcDebugLog('单卡注入失败 [' + name + ']: ' + (e && (e.stack || e.message) || e))
          }
        })
      }

      // 卡片重构：左图格（主图+缩略图 2×2，同找工厂页）+ 中列信息压缩（字体/宽度让位）
      // 图片 URL 有效性：必须是 http(s) 真图；懒加载占位（1px gif/加载动图）一律不要
      const isValidImgUrl = s => s && /^https?:/.test(s) && !s.includes('TB1KM4iT') && !/\/gif;base64/.test(s)
      function restructureSimCard(root) {
        if (root.querySelector('.alocs-sim-imgs')) return true
        const imgBox = root.firstElementChild
        const info = imgBox ? imgBox.nextElementSibling : null
        // 主图懒加载未完成 → 本轮不重构（避免复制出灰占位），等下一轮重扫
        const mainImg = imgBox?.querySelector('img')
        if (mainImg && mainImg.naturalWidth === 0 && mainImg.getAttribute('src')) return false
        // 主图 url：img.src（过滤占位）或背景图
        const bgm = imgBox ? (imgBox.getAttribute('style') || '').match(/url\((['"]?)(.*?)\1\)/) : null
        const mainUrl = [mainImg?.src, bgm?.[2]].find(isValidImgUrl) || ''
        // 商品缩略图：卡内「绝对定位 + 含 ≥2 张真图」的行（普通卡/广告卡都在这个位置），
        // 找不到再兜底抓卡内 40~160px 宽的真图
        const absRows = [...root.querySelectorAll('div[style*="position: absolute"]')]
          .filter(g => [...g.querySelectorAll('img')].filter(i => isValidImgUrl(i.src)).length >= 2)
        const thumbRow = absRows[0] || null
        let thumbUrls = thumbRow
          ? [...thumbRow.querySelectorAll('img')].map(i => i.src).filter(isValidImgUrl).slice(0, 3)
          : []
        if (!thumbUrls.length) {
          thumbUrls = [...root.querySelectorAll('img')]
            .filter(i => {
              if (!isValidImgUrl(i.src)) return false
              const r = i.getBoundingClientRect()
              return r.width >= 40 && r.width <= 160 && r.height >= 40
            })
            .map(i => i.src).slice(0, 3)
        }
        // 左列 2×2 图格：只有拿到至少一张真图才替换，否则保留原图区（避免出现灰框）
        if ((mainUrl || thumbUrls.length) && imgBox) {
          const grid = document.createElement('div')
          grid.className = 'alocs-sim-imgs'
          if (mainUrl) {
            const d = document.createElement('div')
            d.className = 'alocs-sim-th'
            d.style.backgroundImage = `url("${mainUrl}")`
            grid.appendChild(d)
          }
          thumbUrls.forEach(u => {
            const d = document.createElement('div')
            d.className = 'alocs-sim-th'
            d.style.backgroundImage = `url("${u}")`
            grid.appendChild(d)
          })
          root.insertBefore(grid, imgBox)
          imgBox.style.display = 'none'
        }
        if (thumbRow) thumbRow.style.display = 'none'
        // 中列压缩：宽度改弹性、名字 14px、正文 11px（原 580px 固定宽 + 20px 字太占地）
        if (info) {
          info.style.width = 'auto'
          info.style.flex = '1 1 auto'
          info.style.minWidth = '0'
          info.style.marginLeft = '10px'
          info.querySelectorAll('div').forEach(d => {
            const st = d.getAttribute('style') || ''
            if (st.includes('font-weight: bold') || st.includes('font-weight:bold')) {
              d.style.fontSize = '14px'
              d.style.lineHeight = '1.3'
              d.style.whiteSpace = 'normal'
            } else if (!d.children.length) {
              d.style.fontSize = '11px'
            }
          })
        }
        return true
      }
      // ── 工厂店商品网格：逐商品挂 box 备注组件（与搜索列表页完全同款，出现次数由 box batch 语义负责）──
      // 定位锚点用「共N个商品」链接（顶部「工厂店」页签与区块同名，用标题定位会命中页签）
      const shopBoxMounted = new WeakSet()
      function scanFactoryShopProducts() {
        const marker = [...document.querySelectorAll('a')].find(a => /共\d+个商品/.test(a.textContent || ''))
        fcDebugLog('shopScan marker=' + !!marker)
        if (!marker) return
        let grid = marker
        for (let i = 0; i < 8 && grid; i++) {
          grid = grid.parentElement
          if (!grid) break
          if (grid.querySelectorAll('a[href*="detail.1688.com/offer/"]').length >= 3) break
        }
        fcDebugLog('shopScan grid=' + !!grid + (grid ? ' links=' + grid.querySelectorAll('a[href*="detail.1688.com/offer/"]').length : ''))
        if (!grid) return
        const ids = []
        grid.querySelectorAll('a[href*="detail.1688.com/offer/"]').forEach(a => {
          const m = (a.getAttribute('href') || '').match(/offer\/(\d{6,})/)
          if (!m) return
          // 商品卡容器：优先包一层的 div（一 cell 一链接）；工厂店网格 cell 就是 <a> 本身
          const wrapDiv = a.parentElement
          const item = (wrapDiv && wrapDiv.querySelectorAll('a[href*="detail.1688.com/offer/"]').length === 1)
            ? wrapDiv : a
          // DOM 自愈式幂等：React 重渲染抹掉 box 后要能重挂（不能只信 WeakSet）
          if (item.querySelector('.box-main-card')) { shopBoxMounted.add(item); return }
          try {
            shopBoxMounted.add(item)
            ids.push(m[1])
            mountCard(item, m[1], {})
            // 商品格可能是 <a> 或含跳转链接：拦 box 面板内的点击冒泡，防止点备注触发跳转
            requestAnimationFrame(() => {
              const bc = item.querySelector('.box-card')
              if (bc) ['click', 'mousedown', 'mouseup'].forEach(ev =>
                bc.addEventListener(ev, e => e.stopPropagation()))
            })
          } catch (e) {
            console.error('[box:factorycard] 工厂店商品挂载失败:', m[1], e)
            fcDebugLog('工厂店商品挂载失败 [' + m[1] + ']: ' + (e && (e.stack || e.message) || e))
          }
        })
        // 数据读取（同时按 box 语义记出现流水）；供应商名透传给新商品入库
        if (ids.length) {
          const nm = factoryName()
          const supplierMap = {}
          ids.forEach(id => { supplierMap[id] = nm })
          requestBatch(ids, 'factorycard', supplierMap)
        }
      }

      // 卡片随滚动懒加载：MutationObserver 防抖扫描（WeakSet 防重复挂载）
      // 单块扫描异常只记日志不外抛，避免一次坏扫描杀死观察循环
      function scanAllFactoryCards() {
        try { scanSimilarFactories() } catch (e) { console.error('[box:factorycard] 相似工厂扫描异常:', e); fcDebugLog('相似工厂扫描异常: ' + (e && (e.stack || e.message) || e)) }
        try { scanFactoryShopProducts() } catch (e) { console.error('[box:factorycard] 工厂店扫描异常:', e); fcDebugLog('工厂店扫描异常: ' + (e && (e.stack || e.message) || e)) }
      }
      let simScanTimer = null
      const simObserver = new MutationObserver(() => {
        clearTimeout(simScanTimer)
        simScanTimer = setTimeout(scanAllFactoryCards, 300)
      })
      simObserver.observe(document.body, { childList: true, subtree: true })
      // 首扫延后一帧：main() 同步执行期内先让全部闭包变量完成初始化
      setTimeout(scanAllFactoryCards, 0)
      // React 重渲染可能移除注入节点：前 60 秒每 3 秒兜底重扫（WeakSet 防重复挂载）
      let simRescans = 20
      const simRescanTimer = setInterval(() => {
        scanAllFactoryCards()
        if (--simRescans <= 0) clearInterval(simRescanTimer)
      }, 3000)

      // 轮询等 SSR/异步内容就绪：商品列表连续 2 轮不再增长（或超过 8 轮）才记录到访，
      // 避免商品懒加载未完成就落库导致漏采（漏采 = 后台「未采集标题」的来源之一）
      let recorded = false
      let tries = 0
      let lastSize = -1
      let stableCount = 0
      const timer = setInterval(async () => {
        tries++
        const name = factoryName()
        if (!name) {
          if (tries > 20) clearInterval(timer)
          return
        }
        mountNotePanel(name)
        if (!recorded) {
          const prods = collectProducts()
          if (prods.size === lastSize) stableCount++
          else { stableCount = 0; lastSize = prods.size }
          if (prods.size > 0 && (stableCount >= 2 || tries > 8)) {
            recorded = true
            recordVisit(name, prods)
          }
        }
        if ((recorded && panelShown) || tries > 20) clearInterval(timer)
      }, 1000)
    }

    // ════════════════════════════════════════════════
    // C. 找工厂页（s.1688.com/company/pc/factory_search.htm）
    // ════════════════════════════════════════════════
    // 供应商卡片：.space-factory-card（卡片本身 flex 横排），工厂名在 .title-container .title
    // UI：左列 = 原卡片内容（图片重排为 2×2），右列 = 备注列（FactoryNoteCard：富文本 + 折线图 + 统计）
    // 备注复用 comments 表 kind='supplier'，与商品详情页「供应商」页签是同一条数据
    const factoryNotes = reactive({})
    const factoryRequested = new Set()
    // 工厂名 → memberId（卡片内 a.card 链接里的稳定标识）
    const factoryMemberIds = {}
    // 工厂名 → 代表商品 offerId（卡片内 _topOfferId_），后端用它反查公司名当别名
    const factoryOfferIds = {}
    function cardMemberId(card) {
      const a = card.querySelector('a[href*="memberId="]')
      const href = a ? (a.getAttribute('href') || '') : ''
      const m = href.match(/memberId=([^&]+)/)
      return m ? decodeURIComponent(m[1]) : ''
    }
    function cardTopOfferId(card) {
      const a = card.querySelector('a[href*="_topOfferId_"]')
      const href = a ? (a.getAttribute('href') || '') : ''
      const m = href.match(/_topOfferId_=([^&]+)/)
      return m ? decodeURIComponent(m[1]) : ''
    }
    let factoryRenderedCount = 0
    let factoryStyleInjected = false
    // 卡片默认页签：设置 appSettings.factoryCardDefaultTab（'note'|'trend'，默认备注），factoryRun 时读取
    let factoryDefaultTab = 'note'

    function injectFactoryStyles() {
      if (factoryStyleInjected || document.getElementById('alocs-factory-style')) {
        factoryStyleInjected = true
        return
      }
      const style = document.createElement('style')
      style.id = 'alocs-factory-style'
      style.textContent = `
        .space-factory-card.alocs-card-restructured { position: relative; z-index: 0; display: flex; align-items: stretch; }
        .alocs-imgs { width:170px; flex-shrink:0; display:flex; flex-wrap:wrap; gap:6px; align-content:flex-start; margin-right:10px; }
        .alocs-imgs .img-container { width:82px !important; height:82px !important; margin:0 !important; border-radius:4px; overflow:hidden; }
        .alocs-imgs.empty .img-container { width:170px !important; height:170px !important; }
        .alocs-imgs .alocs-th { width:82px; height:82px; border-radius:4px; background-color:#f0f0f0; background-size:cover; background-position:center; flex-shrink:0; }
        .space-factory-card.alocs-card-restructured > .right-container { display:none !important; }
        /* 中栏：公司信息区尽量压缩（可收缩 + 标题允许换两行），把宽度让给右侧备注组 */
        .space-factory-card.alocs-card-restructured > .left-container { flex: 1 1 auto; min-width: 0; max-width: none !important; }
        .space-factory-card.alocs-card-restructured > .left-container > .main-content { flex: 1 1 auto; min-width: 0; }
        .space-factory-card.alocs-card-restructured .title-container { min-width: 0; }
        .space-factory-card.alocs-card-restructured .title-container .title {
          white-space: normal !important; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; line-height: 1.25; }
        .space-factory-card.alocs-card-restructured .desc-container .desc { height: auto !important; max-height: 32px; overflow: hidden; flex-wrap: wrap; line-height: 1.3; }
        .space-factory-card.alocs-card-restructured .rate-container { flex-wrap: wrap; }
        /* 右栏备注组：内部再分“备注 | 折线图”，占卡片约一半，保证两块都看得清 */
        .space-factory-card.alocs-card-restructured > .alocs-factory-mount {
          display: flex; position: relative; z-index: 20; background: #fff; box-sizing: border-box;
          flex: 0 0 clamp(400px, 48%, 560px); margin-left: 10px; padding: 8px 10px 0 12px;
          border-left: 1px solid #f0e6d6; }
      `
      document.head.appendChild(style)
      factoryStyleInjected = true
    }

    // 图片重排：大图 + 商品小图挪进左列 2×2 网格
    function restructureImages(card) {
      if (card.querySelector('.alocs-imgs')) return
      const lc = card.querySelector(':scope > .left-container')
      const imgC = lc && lc.querySelector('.img-container')
      if (!imgC) return
      const thumbs = []
      const oc = card.querySelector('.offer-container')
      if (oc) {
        oc.querySelectorAll('.offer').forEach(o => {
          const m = (o.style.backgroundImage || '').match(/url\((['"]?)(.*?)\1\)/)
          if (m && m[2]) thumbs.push(m[2])
        })
      }
      const imgs = document.createElement('div')
      imgs.className = 'alocs-imgs' + (thumbs.length ? '' : ' empty')
      lc.insertBefore(imgs, imgC)
      imgs.appendChild(imgC)
      thumbs.slice(0, 3).forEach(u => {
        const d = document.createElement('div')
        d.className = 'alocs-th'
        d.style.backgroundImage = `url("${u}")`
        imgs.appendChild(d)
      })
    }

    function collectFactoryNames() {
      const names = new Set()
      document.querySelectorAll('.space-factory-card').forEach(card => {
        const title = card.querySelector('.title-container .title')
        const t = title ? title.textContent.trim() : ''
        if (!t) return
        names.add(t)
        const mid = cardMemberId(card)
        if (mid) factoryMemberIds[t] = mid
        const oid = cardTopOfferId(card)
        if (oid) factoryOfferIds[t] = oid
      })
      return [...names]
    }

    async function requestFactoryBatch(names) {
      const newNames = names.filter(n => !factoryRequested.has(n))
      if (!newNames.length) return
      for (const n of newNames) if (!(n in factoryNotes)) factoryNotes[n] = reactive({ my_comments: [], others_comments: [] })
      newNames.forEach(n => factoryRequested.add(n))
      try {
        const memberIds = {}
        newNames.forEach(n => { if (factoryMemberIds[n]) memberIds[n] = factoryMemberIds[n] })
        const offerIds = {}
        newNames.forEach(n => { if (factoryOfferIds[n]) offerIds[n] = factoryOfferIds[n] })
        const res = await dataApi('/api/v1/suppliers/batch_info', 'POST', { names: newNames, memberIds, offerIds })
        if (res.code === 200) {
          Object.entries(res.data).forEach(([n, d]) => Object.assign(factoryNotes[n], d))
          console.log(`[box:factory] 读取 ${Object.keys(res.data).length} 个工厂备注成功`)
        } else {
          newNames.forEach(n => factoryRequested.delete(n))
          console.error('[box:factory] 读取工厂备注失败:', res.message)
        }
      } catch (e) {
        newNames.forEach(n => factoryRequested.delete(n))
        console.error('[box:factory] 读取工厂备注异常:', e)
      }
    }

    const factoryMountedCards = new WeakSet()

    function renderFactoryCard(card) {
      const title = card.querySelector('.title-container .title')
      const name = title ? title.textContent.trim() : ''
      if (!name) return false
      if (factoryMountedCards.has(card)) return false
      const mid = cardMemberId(card)
      if (mid) factoryMemberIds[name] = mid
      const oid = cardTopOfferId(card)
      if (oid) factoryOfferIds[name] = oid
      const note = factoryNotes[name] || reactive({ my_comments: [], others_comments: [] })
      if (!(name in factoryNotes)) factoryNotes[name] = note

      injectFactoryStyles()
      card.classList.add('alocs-card-restructured')
      restructureImages(card)
      card.querySelectorAll('[class*="7x24"], a[href*="7x24"]').forEach(el => { el.style.display = 'none' })

      const container = document.createElement('div')
      container.className = 'alocs-factory-mount'
      card.appendChild(container)
      const app = createApp(FactoryNoteCard, {
        factoryName: name,
        memberId: mid,
        offerId: oid,
        note,
        defaultTab: factoryDefaultTab,
        // 编辑/删除后重新拉取该工厂备注，直接更新响应式对象 → 组件自动刷新
        reload: async () => {
          factoryRequested.delete(name)
          await requestFactoryBatch([name])
        },
      })
      app.use(pinia)
      app.mount(container)
      factoryMountedCards.add(card)
      return true
    }

    function renderFactoryPage() {
      const cards = document.querySelectorAll('.space-factory-card')
      let mounted = 0
      cards.forEach(card => {
        if (renderFactoryCard(card)) mounted++
      })
      if (mounted > 0) console.log(`[box:factory] 本轮挂载 ${mounted} 张工厂卡备注`)
      return mounted
    }

    async function factoryRun() {
      try {
        const stored = await browser.storage.local.get('appSettings')
        const s = stored.appSettings || {}
        if (s.enableFactorySearch === false) {
          if (factoryRenderedCount === 0) console.log('[box:factory] 找工厂页渲染已被设置关闭（enableFactorySearch=false），不注入')
          return
        }
        factoryDefaultTab = s.factoryCardDefaultTab === 'trend' ? 'trend' : 'note'
      } catch (e) {
        console.error('[box:factory] 读取设置失败:', e)
      }
      const names = collectFactoryNames()
      await requestFactoryBatch(names)
      factoryRenderedCount = renderFactoryPage()
    }

    // ── 启动 ──
    if (isFactorySearch) {
      console.log('[box] 找工厂页流程启动（renderFactoryPage + MutationObserver）')
      factoryRun()
      new MutationObserver(() => setTimeout(factoryRun, 100))
        .observe(document.body, { childList: true, subtree: true })
      return
    }
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
