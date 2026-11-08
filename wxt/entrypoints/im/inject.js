// inject.js — 旺旺客服页「备注」Tab 注入、面板挂载、聊天记录实时采集
// （由 box-content 在 IM 路径下调起）
//
// 页面结构（2026-11 实测）：聊天应用在同源 iframe（def_cbu_web_im_core）里，
// 右侧插件面板 .ww_tab > .OperateTabs--panel > .operate-tab，
// Tab 栏是 Alibaba Fusion Tabs：ul.next-tabs-nav > li.next-tabs-tab.right-plugin-tab-nav > .next-tabs-tab-inner
// 激活态：li 加 active 类 + aria-selected=true；栏高 56px，tab 内边距 8px 20px，字号 16px，
// 激活色 rgb(255,91,0)，常态 rgb(102,102,102)。原生 tab：询盘/档案/商品/我的订单。
//
// 三个关键经验（2026-11 实测踩坑）：
// 1. React 重渲染会整体重建 .operate-tab 子树，把注入的 Tab/面板连带清掉——
//    自愈观察器必须挂在【iframe 文档】上（挂在页面外层听不到 iframe 内部变化）；
// 2. 面板本体绝不能挂进 iframe 文档：wangEditor/Slate 的选区跟踪绑死创建它的
//    document（外层），挂进同源 iframe 后能渲染、能输入、但 onChange 永远不触发
//    （自动保存失效），且 React 重渲染随时清容器。因此「备注」Tab 注入 iframe，
//    面板本体挂【外层】body，用 fixed 定位对齐 iframe 的右侧面板区域。
// 3. 不能用「原生 li 出现 active 类」判断用户切走了 tab：React 重渲染会把 active
//    类恢复到原生 li，导致面板刚打开就被误收起。收起只由真实点击驱动：
//    iframe 文档上的捕获阶段 click 监听，点到原生 li 才收起。
import { createApp } from 'vue'
import App from './App.vue'
import { getImDoc, extractHeaderName, extractImMessages, getImMsgLinks, getResolvedSupplier, emitImShow, emitImDocChange, emitChatUpdated, isSuppressNativeClick } from './imdom.js'
import { api as dataApi } from '@/utils/dataClient.js'

const TAB_ID = 'alocs-im-tab'
const MOUNT_CLS = 'alocs-im-panel-mount'

let liEl = null      // 注入的「备注」tab（在 iframe 文档里，随其重渲染自愈重注入）
let mountEl = null   // 面板容器（外层 body 上，fixed 定位盖住 iframe 右侧面板区）
let app = null       // Vue 应用实例
let panelOpen = false
let lastDoc = null   // 当前工作的 iframe 文档
let docObserver = null
let autoActivated = false    // 每次页面加载只自动激活一次（打开即落在备注 Tab）

// ── 聊天实时采集状态 ──
let savedIds = new Set()       // 本次页面会话已入库的消息 id
let loginIdCache = new Map()   // loginId → 供应商名（采集时顺手解析，避免每条消息都查）
let chatSaveTimer = null

function getNav(doc) {
  return doc.querySelector('.ww_tab ul.next-tabs-nav')
}

// ── 注入「备注」Tab（插到第一位）──
function makeTab() {
  const li = document.createElement('li')
  li.id = TAB_ID
  li.className = 'next-tabs-tab right-plugin-tab-nav'
  li.setAttribute('role', 'tab')
  li.setAttribute('aria-hidden', 'false')
  li.setAttribute('aria-selected', 'false')
  const inner = document.createElement('div')
  inner.className = 'next-tabs-tab-inner'
  inner.textContent = '备注'
  inner.title = 'ALOCS 插件 · 该供应商的备注与信息'
  li.appendChild(inner)
  li.addEventListener('click', (e) => {
    e.stopPropagation()
    e.preventDefault()
    activate()
  })
  return li
}

function injectTab(doc) {
  const nav = getNav(doc)
  if (!nav) return false
  const existing = doc.getElementById(TAB_ID)
  if (existing) {
    liEl = existing
    return true
  }
  liEl = makeTab()
  nav.insertBefore(liEl, nav.firstChild) // 第一个 Tab：备注
  console.log('[alocs:im] 「备注」Tab 已注入（首位）')
  return true
}

// ── 面板容器（外层文档，fixed 定位）──
function ensureMount() {
  if (mountEl && mountEl.isConnected) return true
  if (!mountEl) {
    mountEl = document.createElement('div')
    mountEl.className = MOUNT_CLS
    mountEl.style.cssText = [
      'position:fixed', 'display:none', 'z-index:2147483000',
      'background:#fff', 'box-shadow:-1px 0 0 #f0f0f0',
    ].join(';')
    app = createApp(App)
    app.mount(mountEl)
  }
  document.body.appendChild(mountEl)
  if (!panelOpen) mountEl.style.display = 'none'
  return true
}

// 面板几何：对齐 iframe 右侧插件面板区（.ww_tab）中 Tab 栏以下的区域。
// iframe 内元素的 rect 必须经 iframe 自己的 window 取（外层 window 跨文档
// 调 getBoundingClientRect 返回的是错误坐标系，实测整屏 750）
function syncGeometry() {
  if (!mountEl) return
  const doc = getImDoc()
  const frame = document.querySelector('iframe.layout-iframe')
  const tabArea = doc && doc.querySelector('.ww_tab')
  if (!doc || !frame || !tabArea) { mountEl.style.display = 'none'; return }
  const frameRect = frame.getBoundingClientRect()
  const tabRect = tabArea.getBoundingClientRect() // iframe 视口坐标系
  const tabs = doc.querySelector('.ww_tab .operate-tab .next-tabs')
  let barH = 56
  try {
    const n = parseFloat(doc.defaultView.getComputedStyle(tabs).height)
    if (n > 20 && n < 200) barH = n
  } catch {}
  mountEl.style.left = `${Math.round(frameRect.left + tabRect.left)}px`
  mountEl.style.top = `${Math.round(frameRect.top + tabRect.top + barH)}px`
  mountEl.style.width = `${Math.round(tabRect.width)}px`
  mountEl.style.height = `${Math.round(tabRect.height - barH)}px`
}

function activate() {
  try {
    const doc = getImDoc()
    if (!doc) { document.body.dataset.alocsImErr = 'no-doc'; return }
    if (!injectTab(doc)) { document.body.dataset.alocsImErr = 'no-nav'; return }
    if (!ensureMount()) { document.body.dataset.alocsImErr = 'no-mount'; return }
    panelOpen = true
    syncGeometry()
    mountEl.style.display = ''
    syncActiveVisual(doc)
    delete document.body.dataset.alocsImErr
    emitImShow()
    console.log('[alocs:im] 备注面板已打开')
  } catch (e) {
    console.error('[alocs:im] activate 失败:', e)
    try { document.body.dataset.alocsImErr = 'exception:' + e.message } catch {}
  }
}

function deactivate() {
  if (!panelOpen) return
  panelOpen = false
  if (mountEl) mountEl.style.display = 'none'
  if (liEl && liEl.isConnected) {
    liEl.classList.remove('active')
    liEl.setAttribute('aria-selected', 'false')
  }
  console.log('[alocs:im] 备注面板已收起')
}

// 面板打开期间的视觉保持：自己 active、原生 tab 去激活
// （React 重渲染会复原原生 active 类，由 iframe 内观察器驱动的 tick 随时纠正）
function syncActiveVisual(doc) {
  if (liEl && liEl.isConnected) {
    liEl.classList.add('active')
    liEl.setAttribute('aria-selected', 'true')
  }
  for (const el of doc.querySelectorAll('.ww_tab ul.next-tabs-nav li')) {
    if (el.id !== TAB_ID && el.classList.contains('active')) {
      el.classList.remove('active')
      el.setAttribute('aria-selected', 'false')
    }
  }
}

// ── 用户点击原生 tab → 收起面板（捕获阶段，先于 React 的切换处理）──
function watchNativeClicks(doc) {
  if (doc.__alocsClickWatched) return
  doc.__alocsClickWatched = true
  doc.addEventListener('click', (e) => {
    if (!panelOpen) return
    if (isSuppressNativeClick()) return // 程序化点击（自动读档案）不算用户操作
    const t = e.target
    const li = t && t.closest ? t.closest('.ww_tab ul.next-tabs-nav li') : null
    if (li && li.id !== TAB_ID) deactivate()
  }, true)
}

// ── 聊天记录实时采集：消息列表出现新消息即入库（面板关着也采集）──
// 会话键 = 头部显示名（即时准确；主世界桥的 loginId 有 1.5s 滞后，切换瞬间会错键）
function currentLoginId() {
  return extractHeaderName()
}

function msgId(bare, sender, time, text) {
  let h = 0
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `${bare}|${sender}|${time}|${h.toString(36)}`
}

async function resolveSupplierName(bare, displayName) {
  // 面板解析的权威结果优先（档案识别的实时共享，避免 by-loginid 反查命中被污染的映射）
  const resolved = getResolvedSupplier(bare)
  if (resolved) return resolved
  if (loginIdCache.has(bare)) return loginIdCache.get(bare)
  let name = ''
  try {
    const res = await dataApi(`/api/v1/suppliers/by-loginid?login_id=${encodeURIComponent(bare)}`)
    if (res.code === 200 && res.data?.name) {
      name = res.data.name
      // 只缓存命中（未命中的显示名兜底不缓存，下一次采集能拿到已纠正的名字）
      loginIdCache.set(bare, name)
    }
  } catch {}
  // by-loginid 未命中时，用会话名反查：处理「会话昵称 / 整段会话头部文本」与公司全名不一致
  if (!name && displayName) {
    try {
      const res = await dataApi(`/api/v1/suppliers/resolve?name=${encodeURIComponent(displayName)}`)
      if (res.code === 200 && res.data?.name) {
        name = res.data.name
        loginIdCache.set(bare, name)
      }
    } catch {}
  }
  if (!name && displayName) name = displayName
  return name
}

function scheduleChatSave() {
  if (chatSaveTimer) return
  chatSaveTimer = setTimeout(async () => {
    chatSaveTimer = null
    const dbg = (s) => { try { document.documentElement.dataset.alocsChatDbg = s } catch {} }
    let payload = []
    try {
      const msgs = extractImMessages()
      dbg('extracted:' + msgs.length)
      if (!msgs.length) return
      const bare = currentLoginId()
      if (!bare) { dbg('no-loginid'); return }
      const displayName = extractHeaderName()
      const supplierName = await resolveSupplierName(bare, displayName)
      const doc = getImDoc()
      const activeItem = doc && doc.querySelector('.conversation-item.active')
      const code = (activeItem && activeItem.id) || `alocs-${bare}`
      payload = []
      const usedIds = []
      const sdkLinks = getImMsgLinks() // 主世界桥：{sendTime: [商品URL]}
      // 时间基准：找第一条可解析的时间（部分消息没有标准时间——继承前一条，避免兜底成 Date.now() 打乱排序）
      let lastGoodTs = Date.now()
      for (const m of msgs) {
        const p = m.time ? new Date(m.time.replace(' ', 'T')).getTime() : NaN
        if (Number.isFinite(p) && p > 0) { lastGoodTs = p; break }
      }
      for (const m of msgs) {
        const sender = m.self ? 'me' : 'them'
        const id = msgId(bare, sender, m.time, m.text)
        // 商品卡片消息：DOM 里无链接，从 SDK 桥按时间对齐拿商品 URL
        // （DOM 时间只有秒级精度，SDK sendTime 是毫秒级——用 ±3 秒容差匹配）
        const links = [...(m.links || [])]
        const parsed = m.time ? new Date(m.time.replace(' ', 'T')).getTime() : NaN
        const tsMs = Number.isFinite(parsed) && parsed > 0 ? parsed : lastGoodTs
        lastGoodTs = tsMs // DOM 按时间顺序渲染，无时间的消息继承前一条
        let sdkUrls = null
        if (parsed > 0) {
          for (const k of Object.keys(sdkLinks)) {
            if (Math.abs(Number(k) - parsed) < 3000) { sdkUrls = sdkLinks[k]; break }
          }
        }
        if (sdkUrls) {
          for (const url of sdkUrls) {
            if (!links.some(l => l.href === url)) {
              links.push({ text: '', href: url, offer_id: url.match(/offer\/(\d+)\.html/)?.[1] || '' })
            }
          }
        }
        // 已入库且无需补链接 → 跳过；有链接可补的旧记录也要 POST（localapi 会补全）
        if (savedIds.has(id) && !links.length) continue
        usedIds.push(id)
        payload.push({
          id,
          conversation_code: code,
          login_id: bare,
          display_name: displayName,
          supplier_name: supplierName,
          sender,
          nick: m.nick,
          time: m.time,
          ts: tsMs,
          text: m.text,
          images: m.images,
          links,
        })
      }
      if (!payload.length) { dbg('all-dup'); return }
      const res = await dataApi('/api/v1/chat/messages', 'POST', { messages: payload })
      if (res.code === 200) {
        usedIds.forEach(id => savedIds.add(id))
        dbg('posted:' + res.code + ':' + (res.data?.saved ?? 'null'))
        if (res.data?.saved > 0) {
          console.log(`[alocs:im] 聊天记录入库 ${res.data.saved} 条`)
          emitChatUpdated()
        }
      } else {
        dbg('post-fail:' + res.code + ':' + (res.message || ''))
        console.warn('[alocs:im] 聊天入库被拒:', res.code, res.message)
      }
    } catch (e) {
      // 失败回滚本次标记，下一轮 tick 重试
      for (const p of (payload || [])) savedIds.delete(p.id)
      dbg('error:' + (e && e.message))
      console.warn('[alocs:im] 聊天采集失败', e)
    }
  }, 500)
}

// ── 自愈维护（由 iframe 文档观察器 + 外层观察器共同驱动）──
function tick() {
  const doc = getImDoc()
  if (!doc) return
  if (doc !== lastDoc) {
    lastDoc = doc
    watchNativeClicks(doc)
    observeImDoc(doc)
    emitImDocChange()
    console.log('[alocs:im] iframe 文档就绪/更新')
  }
  // 实时聊天采集（消息列表渲染后才有内容；未选会话时 extract 为空，静默跳过）
  if (doc.querySelector('.message-list div.message-item')) scheduleChatSave()
  if (!getNav(doc)) return // Tab 栏还没渲染（SPA 异步）
  if (!doc.getElementById(TAB_ID)) injectTab(doc)
  // 打开页面即落在「备注」Tab（每次加载只自动激活一次）
  if (!autoActivated) {
    autoActivated = true
    activate()
  }
  if (panelOpen) {
    ensureMount()
    syncGeometry()
    syncActiveVisual(doc)
  }
}

// 直接观察 iframe 文档：React 在 iframe 内重渲染清掉注入节点 / 新消息到达时，这里能立刻知道
function observeImDoc(doc) {
  if (docObserver) docObserver.disconnect()
  docObserver = new MutationObserver(() => setTimeout(tick, 200))
  docObserver.observe(doc.body, { childList: true, subtree: true })
}

/** IM 页流程入口（box-content 在 /app/ocms-fusion-components-1688/ 路径下调起） */
export function setupIm() {
  console.log('[alocs:im] IM 页面板流程启动')
  // 外层观察器：发现 iframe 元素替换 + 窗口尺寸变化时重算几何
  const outerObserver = new MutationObserver(() => setTimeout(tick, 200))
  outerObserver.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', () => { if (panelOpen) syncGeometry() })
  // 低频兜底轮询：任何观察盲区也能自愈
  setInterval(tick, 2000)
  tick()
}
