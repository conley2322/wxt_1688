// imdom.js — 旺旺客服页（IM）的跨文档访问与组件桥
// 整个聊天应用在同源 iframe（air.1688.com/app/ocms-fusion-components-1688/def_cbu_web_im_core）
// 里渲染，Tab 栏与消息列表都在 iframe 文档中。注入逻辑运行在外层页面 content script
// （box-content，manifest 注册固定不能新增入口），同源 iframe 的 contentDocument 可直接读写。

export function getImDoc() {
  const f = document.querySelector('iframe.layout-iframe')
  return f && f.contentDocument ? f.contentDocument : null
}

// ── inject.js ↔ App.vue 桥（两个文档的 DOM 事件不互通，用模块级回调）──
let showHandler = null
let docChangeHandler = null
let chatUpdatedHandler = null

/** App.vue 注册：面板每次展开时刷新数据 */
export function onImShow(fn) { showHandler = fn }
/** inject.js 触发：面板展开 */
export function emitImShow() { showHandler && showHandler() }

/** App.vue 注册：iframe 文档被 1688 重建时重新挂观察器 */
export function onImDocChange(fn) { docChangeHandler = fn }
/** inject.js 触发：检测到 iframe 文档变化 */
export function emitImDocChange() { docChangeHandler && docChangeHandler() }

/** App.vue 注册：实时采集到新聊天消息（面板开着时联动刷新） */
export function onChatUpdated(fn) { chatUpdatedHandler = fn }
/** inject.js 触发：新消息入库 */
export function emitChatUpdated() { chatUpdatedHandler && chatUpdatedHandler() }

// ── 程序化点击原生 Tab 的抑制标志 ──
// 面板开着时自动读档案会点击原生「档案」li，inject 的捕获监听会把一切原生 li
// 点击都当成用户操作而收起面板——程序化点击期间要抑制
let suppressNativeClick = false
export function setSuppressNativeClick(v) { suppressNativeClick = v }
export function isSuppressNativeClick() { return suppressNativeClick }

// ── 面板解析结果桥：App 解析出的「会话名 → 供应商名」实时共享给采集端 ──
// 采集端不再依赖 by-loginid 反查（suppliers.loginIds 可能被历史 bug 污染）
let resolvedMap = new Map()
export function setResolvedSupplier(convName, supplierName) {
  if (convName && supplierName) resolvedMap.set(convName, supplierName)
}
export function getResolvedSupplier(convName) {
  return resolvedMap.get(convName) || ''
}

// ── 会话头部显示名 ──
// 头部结构（2026-11 实测）："<显示名><div class=go-shop>进店/进厂…</div>"
// 显示名可能是登录 ID（如 620gcom/nihaobin8）也可能是公司名（如 鸿霖阀门有限公司），
// 且按钮不止「进店」一个（工厂类供应商还有「进厂」）——把按钮类节点全部移除后取剩余文本
export function extractHeaderName() {
  const doc = getImDoc()
  const header = doc && doc.querySelector('.conversation-header')
  if (!header) return ''
  const clone = header.cloneNode(true)
  // 只删按钮级节点（go-shop/go-factory…），保留 go-shop-container 容器本身与其中的名称文本
  clone.querySelectorAll('[class*="go-"]').forEach((el) => {
    if (!/container/i.test(String(el.className))) el.remove()
  })
  return clone.textContent.trim()
}

/** 主世界桥的消息链接映射（data-alocs-im-msg-links：{sendTime: [商品URL]}） */
export function getImMsgLinks() {
  try {
    const raw = document.documentElement.dataset.alocsImMsgLinks
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// ── 消息提取（inject.js 实时采集用）──
// 结构（2026-11 实测）：.message-list .message-item(.self=自己发的)
//   > .item > img.headPic + div > .first-line(.nick/.time) + .content-row > .content
// 商品卡片消息：content 内含 <a href=detail.1688.com/offer/x.html> 或带埋点属性的卡片
//   （data-aplus-report item_id@商品ID）——两类都提取成可跳转的链接
function readOfferIdFromNode(node) {
  if (!node || !node.getAttribute) return ''
  const aplus = node.getAttribute('data-aplus-report') || ''
  const href = node.getAttribute('href') || ''
  return (
    aplus.match(/item_id@(\d+)/)?.[1] ||
    href.match(/offer\/(\d+)\.html/)?.[1] ||
    href.match(/offerId=(\d+)/)?.[1] ||
    ''
  )
}

export function extractImMessages() {
  const doc = getImDoc()
  if (!doc) return []
  const items = [...doc.querySelectorAll('.message-list div.message-item')]
  const msgs = []
  for (const it of items) {
    const nick = it.querySelector('.first-line .nick')?.textContent.trim() || ''
    const time = it.querySelector('.first-line .time')?.textContent.trim() || ''
    const contentEl = it.querySelector('.content') || it.querySelector('.content-row')
    const text = contentEl ? contentEl.innerText.trim() : ''
    const images = contentEl
      ? [...contentEl.querySelectorAll('img')].map(i => i.src).filter(s => s && !s.startsWith('data:')).slice(0, 9)
      : []
    // 链接提取：a 标签 + 埋点属性卡片（无 href 的商品卡也能拿到 offer_id）
    const links = []
    const seenOffer = new Set()
    if (contentEl) {
      for (const a of contentEl.querySelectorAll('a[href]')) {
        const href = a.href
        if (!href || href.startsWith('javascript:')) continue
        const offerId = readOfferIdFromNode(a)
        links.push({ text: (a.textContent || '').trim().slice(0, 80), href, offer_id: offerId })
        if (offerId) seenOffer.add(offerId)
      }
      // 无 href 的商品卡：埋点属性兜底（卡片点击才跳转的）
      for (const node of contentEl.querySelectorAll('[data-aplus-report*="item_id@"], [data-renderkey]')) {
        const offerId = readOfferIdFromNode(node)
        if (offerId && !seenOffer.has(offerId)) {
          seenOffer.add(offerId)
          links.push({ text: '', href: `https://detail.1688.com/offer/${offerId}.html`, offer_id: offerId })
        }
      }
    }
    if (!text && !nick && !images.length && !links.length) continue
    msgs.push({ self: it.classList.contains('self'), nick, time, text: text.slice(0, 2000), images, links: links.slice(0, 5) })
  }
  return msgs
}

// ── 快捷话术：把文字填进 1688 聊天输入框（用户确认后自己点发送）──
// 1688 输入框是它自家的富文本编辑器（.biz-expression-editor，wangEditor 类），
// 合成 input/execCommand 进不了 Slate 模型，走 paste 事件管道最稳
export function insertIntoChatInput(text) {
  const doc = getImDoc()
  if (!doc) return false
  const editable =
    doc.querySelector('.ww_input .text-panel [contenteditable=true]')
    || doc.querySelector('.ww_input [contenteditable=true]')
    || doc.querySelector('.ww_input textarea')
  if (!editable) return false
  try {
    editable.focus()
    if (editable.isContentEditable) {
      const sel = doc.getSelection()
      sel.selectAllChildren(editable)
      sel.collapseToEnd()
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      editable.dispatchEvent(ev)
    } else {
      // textarea 兜底：追加内容 + 派发 input 让 React 感知
      editable.value = (editable.value || '') + text
      editable.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return true
  } catch {
    return false
  }
}

// ── 原生「档案」Tab：供应商基础信息 ──
// 档案面板结构（2026-11 实测，点击原生档案 Tab 后渲染）：
//   .operate-tab .next-tabs .next-tabs-content .next-tabs-tabpane.active
//     .tab-content .companyName（公司名）/ .year（年限）/ .tradeTypeText（交易方式）/ BSR key/value 对
// 档案里显示的是真实店铺公司名——是 IM 会话名（旺旺昵称）与本地库（详情页提取名）对齐的权威来源

/** 已渲染的档案面板信息（未渲染返回 null）
 *  行级提取：.userInfoItem 行内 .key + 剩余文本为值（避免键值错位），
 *  字段因供应商而异：经营模式/交易方式/成立日期/主营信息/生产档期/加工定制/认证信息/厂房面积/员工人数/BSR 指标… */
export function extractRenderedArchive() {
  const doc = getImDoc()
  if (!doc) return null
  const pane = doc.querySelector('.ww_tab .next-tabs-tabpane.active .tab-content')
  if (!pane) return null
  const companyName = pane.querySelector('.companyName')?.textContent.trim() || ''
  if (!companyName) return null
  const year = pane.querySelector('.year')?.textContent.trim() || ''
  const info = {}
  for (const row of pane.querySelectorAll('.userInfoItem')) {
    const keyEl = row.querySelector('.key')
    if (!keyEl) continue
    const key = keyEl.textContent.replace('：', '').trim()
    let value = row.textContent.replace(keyEl.textContent, '').trim()
    // 清理行内操作链接残留（如交易方式后面的「去发起」）
    value = value.replace(/去发起$/, '').trim()
    if (key && value) info[key] = value.slice(0, 120)
  }
  return { companyName, year, info }
}

/** 点原生 Tab（li 文本匹配），返回是否点到 */
function clickNativeTab(doc, label) {
  const li = [...doc.querySelectorAll('.ww_tab ul.next-tabs-nav li')]
    .find(el => el.id !== 'alocs-im-tab' && el.textContent.trim() === label)
  if (!li) return false
  li.click()
  return true
}

/**
 * 自动读取当前会话的供应商档案：
 * 未渲染时自动点原生「档案」Tab → 等面板渲染 → 提取 → 点回原 Tab。
 * 返回 { companyName, year, info } 或 null
 */
export function readNativeArchive() {
  return new Promise((resolve) => {
    const doc = getImDoc()
    if (!doc) { resolve(null); return }
    const prevActive = doc.querySelector('.ww_tab ul.next-tabs-nav li.active')?.textContent.trim() || ''
    const already = extractRenderedArchive()
    if (already) { resolve(already); return }
    setSuppressNativeClick(true)
    if (!clickNativeTab(doc, '档案')) { setSuppressNativeClick(false); resolve(null); return }
    // 轮询等档案面板渲染（最多 4s）
    let waited = 0
    const finish = (info) => {
      clearInterval(timer)
      setSuppressNativeClick(false)
      // 切回原来的 Tab（若之前无激活 tab 或就是档案则不动）
      if (prevActive && prevActive !== '档案') {
        setTimeout(() => { try { setSuppressNativeClick(true); clickNativeTab(getImDoc() || doc, prevActive) } catch {} finally { setSuppressNativeClick(false) } }, 150)
      }
      resolve(info)
    }
    let timer = setInterval(() => {
      waited += 200
      const info = extractRenderedArchive()
      if (info || waited >= 4000) finish(info)
    }, 200)
  })
}
