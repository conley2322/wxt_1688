// box-scan.content.js — 供应商店铺页卡片扫描器（运行在页面主世界 MAIN）
// 为什么需要它：React 的内部属性（__reactInternalInstance$ / __reactFiber$）只存在于页面主世界，
// 默认的 content script 跑在隔离世界，Object.keys 上看不到这些属性，无法定位卡片。
// 本脚本在主世界扫描 React fiber，找到卡片根后把 offer_id 写到
// data-alocs-offer-id 属性上（DOM 属性两个世界共享），并广播 alocs-cards-marked 事件，
// 由隔离世界的 box-content.content.js 读取标记并挂载 UI（storage/接口请求只能在隔离世界做）。
//
// 卡片识别规则（与店铺域名无关，shop 前缀 / 自定义名均可，已实测 8 家店铺）：
//   1) 任意元素沿 React fiber(.return) 向上找 memoizedProps.data.id 为 9~15 位数字 → 商品数据组件
//   2) 从该 fiber 向下 DFS 子树，第一个「宿主 fiber(tag=5) + onClick + DIV stateNode」= 卡片根元素

const LIST_HOSTS = ['s.1688.com', 'search.1688.com', 'www.1688.com']
const DETAIL_HOST = 'detail.1688.com'
const MARK_ATTR = 'data-alocs-offer-id'

export default defineContentScript({
  matches: ['*://*.1688.com/*'],
  world: 'MAIN',
  main() {
    const host = location.hostname
    // 列表页走 box-content 的 DOM 选择器规则，详情页归 win-content，都不需要 fiber 扫描
    if (host === DETAIL_HOST || LIST_HOSTS.includes(host)) return
    // 旺旺客服页（IM）：没有商品卡片网格，但需要主世界读聊天 iframe 的会话数据
    // （对方登录 ID sNick 在 React fiber 上，隔离世界读不到）→ 写到外层 <html> 的
    // data-alocs-im-loginid 属性，由 im 注入逻辑（隔离世界）读取
    if (location.pathname.startsWith('/app/ocms-fusion-components-1688/')) {
      console.log('[box:scan] IM 页：启动会话 loginId 桥接')
      const fiberKey = el => Object.keys(el).find(k => k.startsWith('__reactFiber'))
      setInterval(() => {
        try {
          const frame = document.querySelector('iframe.layout-iframe')
          const doc = frame && frame.contentDocument
          const hdr = doc && doc.querySelector('.conversation-header')
          if (!hdr) return
          const fk = fiberKey(hdr)
          if (!fk) return
          let fiber = hdr[fk]
          let loginId = ''
          for (let i = 0; i < 12 && fiber; i++) {
            const p = fiber.memoizedProps
            if (p && typeof p.sNick === 'string' && p.sNick) { loginId = p.sNick; break }
            fiber = fiber.return
          }
          if (loginId) {
            document.documentElement.dataset.alocsImLoginId = loginId
          }
        } catch {}
      }, 1500)

      // ── 消息链接桥：商品卡片消息的 DOM 里没有链接（React 点击跳转），
      // 链接只在 _imsdk 消息实体里（summary/originalData 含 detail.1688.com/offer/x.html）。
      // 按当前会话拉消息，把 {sendTime: [商品URL]} 写到 data-alocs-im-msg-links，
      // 采集端按 DOM 时间 → sendTime 对齐后给消息挂链接。
      let lastMsgCode = ''
      let lastLinksJson = ''
      setInterval(async () => {
        try {
          const frame = document.querySelector('iframe.layout-iframe')
          const doc = frame && frame.contentDocument
          const activeItem = doc && doc.querySelector('.conversation-item.active')
          if (!activeItem || !activeItem.id) return
          const code = activeItem.id
          const imsdk = frame.contentWindow && frame.contentWindow._imsdk
          if (!imsdk) return
          if (code !== lastMsgCode) {
            lastMsgCode = code
            document.documentElement.dataset.alocsImMsgLinks = ''
          }
          const ms = imsdk.getMessageService()
          const r = await new Promise((res, rej) => ms.listMessageWithConversationCode({
            cursor: { sendTime: 0 }, fetchType: 0, conversationCode: code, count: 100,
            dataCallback: res, errorCallBack: rej,
          }))
          const list = r.data || []
          const map = {}
          for (const m of list) {
            const urls = (JSON.stringify(m).match(/https?:[^"]*detail\.1688\.com\/offer\/\d+\.html/g)) || []
            if (urls.length && m.sendTime) {
              map[String(m.sendTime)] = [...new Set(urls)].slice(0, 3)
            }
          }
          const json = JSON.stringify(map)
          if (json !== lastLinksJson) {
            lastLinksJson = json
            document.documentElement.dataset.alocsImMsgLinks = json
          }
        } catch {}
      }, 5000)
      return
    }

    console.log('[box:scan] 主世界扫描器启动 — host:', host)

    // 从商品数据组件 fiber 向下 DFS，找卡片根：第一个「宿主 fiber(tag=5) + onClick + DIV」
    function findCardRoot(dataFiber) {
      const stack = []
      if (dataFiber.child) stack.push(dataFiber.child)
      let guard = 0
      while (stack.length && guard++ < 5000) {
        const f = stack.pop()
        if (!f) continue
        if (f.tag === 5 && f.memoizedProps?.onClick && f.stateNode?.tagName === 'DIV') {
          return f.stateNode
        }
        if (f.sibling) stack.push(f.sibling)
        if (f.child) stack.push(f.child)
      }
      return null
    }

    let scanCount = 0

    function scan() {
      scanCount++
      let divs = 0
      let fibers = 0
      let hits = 0
      let markedNew = 0
      const seen = new Set()

      for (const el of document.querySelectorAll('div')) {
        divs++
        const fiberKey = Object.keys(el).find(k =>
          k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber')
        )
        if (!fiberKey) continue
        fibers++

        // 沿 fiber.return 向上找商品数据组件
        let f = el[fiberKey]
        let depth = 0
        let dataFiber = null
        while (f && depth < 20) {
          const props = f.memoizedProps
          if (props?.data?.id && /^\d{9,15}$/.test(String(props.data.id))) {
            dataFiber = f
            break
          }
          f = f.return
          depth++
        }
        if (!dataFiber) continue
        hits++

        const offerId = String(dataFiber.memoizedProps.data.id)
        if (seen.has(offerId)) continue
        seen.add(offerId)

        const card = findCardRoot(dataFiber)
        // 只有能定位到卡片根（可见可点击卡片）的才标记；
        // 同一 offer 可能存在不可点击的隐藏数据实例，借此过滤
        if (card && card.getAttribute(MARK_ATTR) !== offerId) {
          card.setAttribute(MARK_ATTR, offerId)
          markedNew++
        }
      }

      // 日志：首轮详细，后续仅在新标记时打印，避免刷屏
      if (scanCount === 1) {
        console.log(`[box:scan] 第1轮扫描详情: div ${divs} / React fiber ${fibers} / 命中商品数据 ${hits} / 新标记卡片 ${markedNew}`)
      } else if (markedNew > 0) {
        console.log(`[box:scan] 第${scanCount}轮扫描: 新标记 ${markedNew} 张卡片`)
      }

      if (markedNew > 0) {
        document.dispatchEvent(new CustomEvent('alocs-cards-marked', { detail: { marked: markedNew } }))
      }
    }

    scan()
    new MutationObserver(() => setTimeout(scan, 150))
      .observe(document.body, { childList: true, subtree: true })
  },
})
