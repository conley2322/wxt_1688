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
