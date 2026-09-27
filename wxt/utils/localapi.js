// localapi.js — 单机版本地接口路由器
// 拦截原后端的所有 /api/v1/* 路径，在 IndexedDB 上实现同名接口，
// 返回结构与原后端一致（{ code, data, total... }），页面代码无需大改。

import { db, uid, getProfile, saveProfile, storageInfo, getQuotaMB, setQuotaMB, cleanupIfNeeded, exportData, importData } from './localdb.js'

const DAY = 86400000

function ok(data, extra = {}) {
  return { code: 200, data, message: '获取成功', ...extra }
}

async function me() {
  return getProfile()
}

async function log(action, detail) {
  await db.add('operation_logs', { action, detail, created_at: Date.now() })
}

// ── 查询辅助 ──
async function myComments(kind, target) {
  const list = await db.all('comments')
  return list
    .filter(c => c.kind === kind && c.target === target)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

async function upsertProduct(offer_id, title, main_img_url, supplier_name) {
  let p = await db.get('products', offer_id)
  if (!p) {
    p = { offer_id, title: title || '', main_img_url: main_img_url || '', supplier_name: supplier_name ? supplier_name.trim() : '', created_at: Date.now() }
    await db.put('products', p)
  } else {
    // 补充空字段（每次浏览都可能拿到新数据）
    const patch = {}
    if (!p.main_img_url && main_img_url) patch.main_img_url = main_img_url
    if (!p.title && title) patch.title = title
    if (!p.supplier_name && supplier_name) patch.supplier_name = supplier_name.trim()
    if (Object.keys(patch).length) await db.put('products', { ...p, ...patch })
  }
  return db.get('products', offer_id)
}

// 连带删除单个商品的全部数据：浏览/出现流水 + 商品评论 + 商品本体
async function purgeProduct(offer_id) {
  await db.deleteWhere('view_records', r => r.offer_id === offer_id)
  await db.deleteWhere('appear_records', r => r.offer_id === offer_id)
  await db.deleteWhere('comments', c => c.kind === 'product' && c.target === offer_id)
  await db.delete('products', offer_id)
}

// ════════════════════════════════════
// 远程（他人）数据合并辅助
// ════════════════════════════════════
const DEFAULT_MULTI_VIEW = { showOthersComments: true, showOthersViews: true, showOnListPage: true }

async function getMultiSettings() {
  const { multiSettings } = await browser.storage.local.get('multiSettings')
  return { ...DEFAULT_MULTI_VIEW, ...(multiSettings || {}) }
}

// 远程评论的时间可能是数字时间戳或 ISO 字符串，统一转毫秒数
function commentTime(c) {
  const v = c.updated_at || c.created_at
  return typeof v === 'number' ? v : new Date(v).getTime()
}

// 商品维度他人数据（评论按最近更新降序）
function othersForProduct(snap, offer_id, selfToken) {
  if (!snap) return { view_count: 0, appear_count: 0, comments: [] }
  const view_count = snap.view_records.filter(
    r => r.offer_id === offer_id && r.token !== selfToken
  ).length
  const appear_count = snap.appear_records.filter(
    r => r.offer_id === offer_id && r.token !== selfToken
  ).length
  const comments = snap.comments
    .filter(c => c.kind === 'product' && c.target === String(offer_id) && c.token !== selfToken)
    .sort((a, b) => commentTime(b) - commentTime(a))
  return { view_count, appear_count, comments }
}

// 供应商维度他人笔记
function othersForSupplier(snap, name, selfToken) {
  if (!snap) return { comments: [] }
  const comments = snap.comments
    .filter(c => c.kind === 'supplier' && c.target === name && c.token !== selfToken)
    .sort((a, b) => commentTime(b) - commentTime(a))
  return { comments }
}

// 商品近 30 天他人每日聚合（与 stats 本地 daily 对齐）
function othersDailyForProduct(snap, offer_id, selfToken) {
  const daily = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const views = snap
    ? snap.view_records.filter(r => r.offer_id === offer_id && r.token !== selfToken)
    : []
  const appears = snap
    ? snap.appear_records.filter(r => r.offer_id === offer_id && r.token !== selfToken)
    : []
  for (let i = 29; i >= 0; i--) {
    const dayStart = today.getTime() - i * DAY
    daily.push({
      view: views.filter(v => v.viewed_at >= dayStart && v.viewed_at < dayStart + DAY).length,
      appear: appears.filter(v => v.appeared_at >= dayStart && v.appeared_at < dayStart + DAY).length,
    })
  }
  return daily
}

// ════════════════════════════════════
// 路由表
// ════════════════════════════════════
async function route(path, method, body, query) {
  const user = await me()

  // ── 个人资料 / 存储管理 ──
  if (path === '/api/v1/users' && method === 'GET') {
    return ok([{ id: 1, username: user.nickname, nickname: user.nickname, email: user.email || '', avatar_color: user.avatar_color, role: 'admin', status: 1, created_at: '' }])
  }
  if (path === '/api/v1/users/profile' && method === 'PUT') {
    const patch = {}
    if (body.avatar_color) patch.avatar_color = body.avatar_color
    if (body.username || body.nickname) patch.nickname = body.username || body.nickname
    if (body.email !== undefined) patch.email = body.email
    const p = await saveProfile(patch)
    return ok(p)
  }
  if (path === '/api/v1/local/storage' && method === 'GET') {
    const [info, quotaMB] = [await storageInfo(), await getQuotaMB()]
    return ok({ ...info, quotaMB })
  }
  if (path === '/api/v1/local/quota' && method === 'PUT') {
    await setQuotaMB(body.quotaMB)
    return ok({ quotaMB: await getQuotaMB() })
  }
  if (path === '/api/v1/local/cleanup' && method === 'POST') {
    return ok(await cleanupIfNeeded())
  }
  if (path === '/api/v1/local/export' && method === 'POST') {
    return ok(await exportData())
  }
  if (path === '/api/v1/local/import' && method === 'POST') {
    return ok(await importData(body.data, body.mode || 'merge'))
  }

  // ── 商品浏览（win 详情页每次进入调用）──
  if (path === '/api/v1/products/Product_browsing_history' && method === 'POST') {
    const { offer_id, title, main_img_url, supplier_name } = body
    await upsertProduct(offer_id, title, main_img_url, supplier_name)
    await db.add('view_records', { offer_id, viewed_at: Date.now() })
    const records = (await db.all('view_records')).filter(r => r.offer_id === offer_id)
    const p = await getProfile()
    return ok({
      view_count: records.length,
      viewers: [{ username: p.nickname, initial: p.nickname.charAt(0), avatar_color: p.avatar_color, count: records.length }],
    })
  }
  if (path === '/api/v1/products' && method === 'POST') {
    await upsertProduct(body.offer_id, body.title, body.main_img_url, body.supplier_name)
    return ok({ offer_id: body.offer_id })
  }
  if (path === '/api/v1/suppliers' && method === 'POST') {
    const exist = await db.get('suppliers', body.name)
    if (!exist) {
      await db.put('suppliers', { name: body.name, address: '', memberId: body.memberId || '', created_at: Date.now() })
    }
    return ok({ name: body.name })
  }

  // ── 卡片批量信息（box）──
  // 语义：requestBatch 只对"本次页面会话首次渲染"的商品发请求，
  // 因此收到请求 = 该商品本次刷出 → 出现次数 +1（与详情页浏览次数分开统计）
  if (path === '/api/v1/products/batch_info' && method === 'POST') {
    const uniqueIds = [...new Set(body.offer_ids || [])]
    // 页面提取的供应商名（offer_id → 名称），在添加记录时与产品一一对应
    const supplierMap = body.supplier_map || {}
    // 出现次数 +1（每个商品一条流水）
    for (const offer_id of uniqueIds) {
      await db.add('appear_records', { offer_id, appeared_at: Date.now() })
    }
    const [products, records, comments, appears, snap, multi, storedId] = await Promise.all([
      db.all('products'), db.all('view_records'), db.all('comments'), db.all('appear_records'),
      db.get('remote_snapshot', 'snapshot'),
      getMultiSettings(),
      browser.storage.local.get('token'),
    ])
    const selfToken = storedId.token || ''
    // 有浏览记录的商品集合（box2 计数依据）
    const viewedOfferIds = new Set(records.map(r => r.offer_id))
    const result = {}
    // 每个请求的商品都返回一条（未浏览过的返回 0），保证卡片一定能匹配到真实数据
    for (const offer_id of uniqueIds) {
      const p = products.find(x => x.offer_id === offer_id)
      const pageSupplierName = typeof supplierMap[offer_id] === 'string' ? supplierMap[offer_id].trim() : ''
      // 建立/补充 产品↔供应商 映射：列表刷出时即落库，无需等点进详情页
      let supplierName = p?.supplier_name || ''
      if (!supplierName && pageSupplierName) {
        supplierName = pageSupplierName
        if (p) {
          await db.put('products', { ...p, supplier_name: pageSupplierName })
        } else {
          await db.put('products', { offer_id, title: '', main_img_url: '', supplier_name: pageSupplierName, created_at: Date.now() })
        }
      }
      const views = records.filter(r => r.offer_id === offer_id)
      const apps = appears.filter(r => r.offer_id === offer_id)
      const cmts = comments.filter(c => c.kind === 'product' && c.target === offer_id)
      // 最近 50 天按天聚合（box1 上下双图数据源：出现 + 浏览，前端按需切片 7/15/20/30/50）
      const timeline = []
      const today = new Date(); today.setHours(0, 0, 0, 0)
      for (let i = 49; i >= 0; i--) {
        const dayStart = today.getTime() - i * DAY
        const label = `${String(new Date(dayStart).getMonth() + 1).padStart(2, '0')}-${String(new Date(dayStart).getDate()).padStart(2, '0')}`
        timeline.push({
          date: label,
          appear: apps.filter(v => v.appeared_at >= dayStart && v.appeared_at < dayStart + DAY).length,
          view: views.filter(v => v.viewed_at >= dayStart && v.viewed_at < dayStart + DAY).length,
        })
      }
      // box2：供应商维度 —— 按供应商名精确匹配，该供应商下我浏览过的商品数（去重）
      const supplierViewedCount = supplierName
        ? new Set(products.filter(x => x.supplier_name === supplierName && viewedOfferIds.has(x.offer_id)).map(x => x.offer_id)).size
        : 0

      // 他人数据（受三个多人开关控制）
      const o = multi.showOnListPage ? othersForProduct(snap, offer_id, selfToken) : null
      const others = o
        ? {
            appear_count: multi.showOthersViews ? o.appear_count : 0,
            view_count: multi.showOthersViews ? o.view_count : 0,
            comments: multi.showOthersComments ? o.comments : [],
          }
        : { appear_count: 0, view_count: 0, comments: [] }

      result[offer_id] = {
        appear_count: apps.length,
        view_count: views.length,
        comment_count: cmts.length,
        i_have_viewed: views.length > 0,
        last_viewed_at: views.length ? Math.max(...views.map(v => v.viewed_at)) : null,
        my_views_timeline: timeline,
        supplier_name: supplierName,
        supplier_viewed_count: supplierViewedCount,
        others,
      }
    }
    return ok(result)
  }

  // ── 商品列表（管理后台）──
  if (path === '/api/v1/products/mine' && method === 'GET') {
    const pageNum = parseInt(query.page) || 1
    const pageSize = parseInt(query.page_size) || 20
    let products = await db.all('products')
    const [records, comments] = await Promise.all([db.all('view_records'), db.all('comments')])
    const lastView = {}
    for (const r of records) lastView[r.offer_id] = Math.max(lastView[r.offer_id] || 0, r.viewed_at)
    // 只显示我浏览过的商品（对齐原版语义）
    let list = products.filter(p => lastView[p.offer_id])
    let result = list.map(p => {
      const cmts = comments.filter(c => c.kind === 'product' && c.target === p.offer_id)
      return {
        ...p,
        my_comment: (cmts[0] || {}).text || null,
        comment_count: cmts.length,
        view_count: (lastView[p.offer_id] ? records.filter(r => r.offer_id === p.offer_id).length : 0),
      }
    })
    if (query.search && query.search_type === 'title') {
      result = result.filter(p => p.title && p.title.includes(query.search))
    }
    if (query.search && query.search_type === 'comment') {
      result = result.filter(p => cmtsTextHas(p.offer_id, query.search, comments))
    }
    // 按笔记状态筛选：commented=有笔记 / uncommented=仅浏览无笔记
    if (query.comment_status === 'commented') result = result.filter(p => p.comment_count > 0)
    else if (query.comment_status === 'uncommented') result = result.filter(p => p.comment_count === 0)
    if (query.sort_by === 'view_count') {
      result.sort((a, b) => query.sort_order === 'asc' ? a.view_count - b.view_count : b.view_count - a.view_count)
    } else if (query.sort_by === 'comment_count') {
      result.sort((a, b) => query.sort_order === 'asc' ? a.comment_count - b.comment_count : b.comment_count - a.comment_count)
    } else {
      result.sort((a, b) => (lastView[b.offer_id] || 0) - (lastView[a.offer_id] || 0))
    }
    // 概览统计（不受筛选影响，供页面顶部统计卡片使用）
    const statsOverview = {
      total: list.length,
      commented: list.filter(p => comments.some(c => c.kind === 'product' && c.target === p.offer_id)).length,
      total_views: records.length,
    }
    statsOverview.uncommented = statsOverview.total - statsOverview.commented
    const total = result.length
    return ok(result.slice((pageNum - 1) * pageSize, pageNum * pageSize), { total, stats: statsOverview })
  }

  // ── 我的货源：供应商分组 + 组内全部商品（合并页数据源）──  // GET /api/v1/products/grouped
  if (path === '/api/v1/products/grouped' && method === 'GET') {
    const [products, records, comments, appears, suppliersTable] = await Promise.all([
      db.all('products'), db.all('view_records'), db.all('comments'), db.all('appear_records'), db.all('suppliers'),
    ])
    // 浏览计数 / 最近浏览
    const viewCountMap = {}
    const lastView = {}
    for (const r of records) {
      viewCountMap[r.offer_id] = (viewCountMap[r.offer_id] || 0) + 1
      lastView[r.offer_id] = Math.max(lastView[r.offer_id] || 0, r.viewed_at)
    }
    // 出现计数
    const appearCountMap = {}
    for (const a of appears) appearCountMap[a.offer_id] = (appearCountMap[a.offer_id] || 0) + 1
    // 商品评论 / 供应商评论（按 target 归组）
    const productCommentMap = {}
    const supplierCommentMap = {}
    for (const c of comments) {
      if (c.kind === 'product') (productCommentMap[c.target] ||= []).push(c)
      if (c.kind === 'supplier') (supplierCommentMap[c.target] ||= []).push(c)
    }
    // 供应商集合：浏览过的商品所属供应商 ∪ suppliers 表 ∪ 有供应商评论的
    const viewedIds = new Set(records.map(r => r.offer_id))
    const names = new Set()
    for (const p of products) if (p.supplier_name && viewedIds.has(p.offer_id)) names.add(p.supplier_name)
    for (const s of suppliersTable) names.add(s.name)
    for (const name of Object.keys(supplierCommentMap)) names.add(name)

    let groups = [...names].filter(Boolean).map(name => {
      const supCmts = (supplierCommentMap[name] || [])
        .slice()
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      const prods = products
        .filter(p => p.supplier_name === name && viewedIds.has(p.offer_id))
        .map(p => {
          const cs = productCommentMap[p.offer_id] || []
          return {
            offer_id: p.offer_id,
            title: p.title,
            main_img_url: p.main_img_url,
            view_count: viewCountMap[p.offer_id] || 0,
            appear_count: appearCountMap[p.offer_id] || 0,
            comment_count: cs.length,
            my_comment: cs[0]?.text || null,
            last_viewed_at: lastView[p.offer_id] || null,
          }
        })
      // 组内：有笔记的在前，再按最近浏览降序
      prods.sort((a, b) => Number(b.comment_count > 0) - Number(a.comment_count > 0)
        || (b.last_viewed_at || 0) - (a.last_viewed_at || 0))
      return {
        supplier_name: name,
        comment_count: supCmts.length,
        supplier_comments: supCmts,
        products: prods,
        product_count: prods.length,
        last_activity: Math.max(
          ...prods.map(p => p.last_viewed_at || 0),
          ...supCmts.map(c => new Date(c.updated_at || c.created_at).getTime()),
          0
        ),
      }
    })
    const groupHasNotes = g => g.comment_count > 0 || g.products.some(p => p.comment_count > 0)
    // 组排序：有笔记的在前，再按最近活动降序
    groups.sort((a, b) => Number(groupHasNotes(b)) - Number(groupHasNotes(a)) || b.last_activity - a.last_activity)

    // 搜索：供应商名或商品标题
    if (query.search) {
      const kw = query.search.toLowerCase()
      groups = groups.filter(g =>
        g.supplier_name.toLowerCase().includes(kw)
        || g.products.some(p => p.title?.toLowerCase().includes(kw)))
    }

    const stats = {
      total_suppliers: groups.length,
      suppliers_with_notes: groups.filter(groupHasNotes).length,
      total_products: groups.reduce((s, g) => s + g.product_count, 0),
      products_with_notes: groups.reduce((s, g) => s + g.products.filter(p => p.comment_count > 0).length, 0),
      total_views: records.length,
      total_appears: appears.length,
    }
    return ok(groups, { stats })
  }

  // ── 删除商品（连带浏览/出现流水和商品评论）──  // DELETE /api/v1/products/:id
  const mProductDelete = path.match(/^\/api\/v1\/products\/([^/]+)$/)
  if (mProductDelete && method === 'DELETE') {
    const offer_id = decodeURIComponent(mProductDelete[1])
    await purgeProduct(offer_id)
    await log('DELETE /api/v1/products/:id', `删除了商品 ${offer_id} 及其全部数据`)
    return ok(null)
  }

  // ── 批量删除商品 ──  // POST /api/v1/products/batch-delete
  if (path === '/api/v1/products/batch-delete' && method === 'POST') {
    const ids = [...new Set(body.offer_ids || [])]
    for (const id of ids) await purgeProduct(id)
    await log('POST /api/v1/products/batch-delete', `批量删除了 ${ids.length} 个商品`)
    return ok({ deleted: ids.length })
  }

  // ── 删除供应商（连带名下商品全部数据 + 供应商评论）──  // DELETE /api/v1/suppliers/:name
  const mSupplierDelete = path.match(/^\/api\/v1\/suppliers\/([^/]+)$/)
  if (mSupplierDelete && method === 'DELETE') {
    const name = decodeURIComponent(mSupplierDelete[1])
    const prods = await db.all('products')
    const ids = [...new Set(prods.filter(p => p.supplier_name === name).map(p => p.offer_id))]
    for (const id of ids) await purgeProduct(id)
    await db.deleteWhere('comments', c => c.kind === 'supplier' && c.target === name)
    await db.delete('suppliers', name)
    await log('DELETE /api/v1/suppliers/:name', `删除了供应商「${name}」及名下 ${ids.length} 个商品`)
    return ok(null)
  }

  // ── 商品数据统计 ──  // GET /api/v1/products/:id/stats
  const mProductStats = path.match(/^\/api\/v1\/products\/([^/]+)\/stats$/)
  if (mProductStats && method === 'GET') {
    const offer_id = decodeURIComponent(mProductStats[1])
    const [products, records, comments, appears, snap, multi, storedId] = await Promise.all([
      db.all('products'), db.all('view_records'), db.all('comments'), db.all('appear_records'),
      db.get('remote_snapshot', 'snapshot'),
      getMultiSettings(),
      browser.storage.local.get('token'),
    ])
    const selfToken = storedId.token || ''
    const views = records.filter(r => r.offer_id === offer_id)
    const apps = appears.filter(r => r.offer_id === offer_id)
    const cmts = comments.filter(c => c.kind === 'product' && c.target === offer_id)

    // 近 30 天每日聚合（出现 + 浏览）
    const daily = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (let i = 29; i >= 0; i--) {
      const dayStart = today.getTime() - i * DAY
      const d = new Date(dayStart)
      daily.push({
        date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        view: views.filter(v => v.viewed_at >= dayStart && v.viewed_at < dayStart + DAY).length,
        appear: apps.filter(v => v.appeared_at >= dayStart && v.appeared_at < dayStart + DAY).length,
      })
    }

    // 24 小时浏览时段分布
    const hourly = new Array(24).fill(0)
    for (const v of views) hourly[new Date(v.viewed_at).getHours()]++

    const product = products.find(p => p.offer_id === offer_id)
    const supplierName = product?.supplier_name || ''
    const viewedOfferIds = new Set(records.map(r => r.offer_id))
    const supplierViewedCount = supplierName
      ? new Set(products.filter(p => p.supplier_name === supplierName && viewedOfferIds.has(p.offer_id)).map(p => p.offer_id)).size
      : 0

    return ok({
      totals: {
        view_count: views.length,
        appear_count: apps.length,
        comment_count: cmts.length,
      },
      first_viewed_at: views.length ? Math.min(...views.map(v => v.viewed_at)) : null,
      last_viewed_at: views.length ? Math.max(...views.map(v => v.viewed_at)) : null,
      // 每次浏览的精确时间（降序），供管理页浏览时间线使用
      view_times: views.map(v => v.viewed_at).sort((a, b) => b - a),
      supplier_name: supplierName,
      supplier_viewed_count: supplierViewedCount,
      daily,
      hourly,
      // 他人浏览/出现（近 30 天），未连接或关闭开关时返回 0
      others_totals: multi.showOthersViews
        ? { view_count: othersForProduct(snap, offer_id, selfToken).view_count,
            appear_count: othersForProduct(snap, offer_id, selfToken).appear_count }
        : { view_count: 0, appear_count: 0 },
      others_daily: multi.showOthersViews
        ? othersDailyForProduct(snap, offer_id, selfToken)
        : null,
    })
  }

  // ── 商品浏览时间轴 ──  // GET /api/v1/products/:id/view-timeline
  const mViewTimeline = path.match(/^\/api\/v1\/products\/([^/]+)\/view-timeline$/)
  if (mViewTimeline && method === 'GET') {
    const offer_id = decodeURIComponent(mViewTimeline[1])
    const [records, snap, multi, stored] = await Promise.all([
      db.all('view_records'),
      db.get('remote_snapshot', 'snapshot'),
      getMultiSettings(),
      browser.storage.local.get(['token', 'nickname']),
    ])
    const selfToken = stored.token || ''
    const profile = await me()
    const myName = stored.nickname || profile.nickname || '我'

    // 自己的浏览：取本地记录
    const items = records
      .filter(r => r.offer_id === offer_id)
      .map(r => ({ token: selfToken, nickname: myName, viewed_at: r.viewed_at, mine: true }))

    // 他人浏览：远程快照中排除自己（避免与本地重复），受 showOthersViews 控制
    if (multi.showOthersViews && snap) {
      const nameOf = {}
      for (const c of snap.clients || []) nameOf[c.token] = c.nickname
      for (const r of snap.view_records || []) {
        if (r.offer_id === offer_id && r.token !== selfToken) {
          items.push({ token: r.token, nickname: nameOf[r.token] || '匿名', viewed_at: r.viewed_at, mine: false })
        }
      }
    }

    items.sort((a, b) => a.viewed_at - b.viewed_at) // 正序：旧在上、新在下
    return ok(items)
  }

  // ── 商品的他人笔记 ──  // GET /api/v1/products/:id/others
  const mProductOthers = path.match(/^\/api\/v1\/products\/([^/]+)\/others$/)
  if (mProductOthers && method === 'GET') {
    const offer_id = decodeURIComponent(mProductOthers[1])
    const [snap, multi, storedId] = await Promise.all([
      db.get('remote_snapshot', 'snapshot'),
      getMultiSettings(),
      browser.storage.local.get('token'),
    ])
    if (!multi.showOthersComments) return ok({ comments: [] })
    return ok(othersForProduct(snap, offer_id, storedId.token || ''))
  }

  // ── 供应商的他人笔记 ──  // GET /api/v1/suppliers/others?supplier_name=xx
  if (path === '/api/v1/suppliers/others' && method === 'GET') {
    const [snap, multi, storedId] = await Promise.all([
      db.get('remote_snapshot', 'snapshot'),
      getMultiSettings(),
      browser.storage.local.get('token'),
    ])
    if (!multi.showOthersComments) return ok({ comments: [] })
    return ok(othersForSupplier(snap, query.supplier_name, storedId.token || ''))
  }

  // ── 商品评论 ──
  const mProductComments = path.match(/^\/api\/v1\/products\/([^/]+)\/comments$/)
  if (mProductComments && method === 'GET') {
    return ok(await myComments('product', decodeURIComponent(mProductComments[1])))
  }
  if (mProductComments && method === 'POST') {
    const target = decodeURIComponent(mProductComments[1])
    const c = { id: uid(), kind: 'product', target, text: body.text, created_at: new Date().toISOString(), updated_at: null }
    await db.put('comments', c)
    await log('POST ' + path, '添加了商品评论')
    return ok(c)
  }
  const mCommentUpd = path.match(/^\/api\/v1\/products\/comments\/([^/]+)$/)
  if (mCommentUpd && method === 'PUT') {
    const c = await db.get('comments', mCommentUpd[1])
    if (c) { c.text = body.text; c.updated_at = new Date().toISOString(); await db.put('comments', c) }
    return ok(c)
  }
  if (mCommentUpd && method === 'DELETE') {
    await db.delete('comments', mCommentUpd[1])
    await log('DELETE ' + path, '删除了商品评论')
    return ok(null)
  }

  // 商品评论自动保存：有则更新、无则创建、清空则删除  // PUT /api/v1/products/:id/comments/auto
  const mProductCommentAuto = path.match(/^\/api\/v1\/products\/([^/]+)\/comments\/auto$/)
  if (mProductCommentAuto && method === 'PUT') {
    const target = decodeURIComponent(mProductCommentAuto[1])
    const existing = (await db.all('comments')).find(x => x.kind === 'product' && x.target === target)
    const blank = !hasCommentContent(body.text)
    if (blank && existing) { await db.delete('comments', existing.id); return ok(null) }
    if (blank) return ok(null)
    if (existing) {
      existing.text = body.text
      existing.updated_at = new Date().toISOString()
      await db.put('comments', existing)
      return ok(existing)
    }
    const c = { id: uid(), kind: 'product', target, text: body.text, created_at: new Date().toISOString(), updated_at: null }
    await db.put('comments', c)
    return ok(c)
  }

  // ── 商品标签接口已移除（标签功能下线）──

  // ── 供应商 ──
  if (path === '/api/v1/suppliers/my-suppliers' && method === 'GET') {
    const [products, records, comments, suppliers] = await Promise.all([
      db.all('products'), db.all('view_records'), db.all('comments'), db.all('suppliers'),
    ])
    const names = new Set()
    for (const p of products) if (p.supplier_name && records.some(r => r.offer_id === p.offer_id)) names.add(p.supplier_name)
    for (const s of suppliers) names.add(s.name)
    let list = [...names].filter(Boolean).map(name => {
      const myProducts = [...new Set(products.filter(p => p.supplier_name === name).map(p => p.offer_id))]
        .filter(oid => records.some(r => r.offer_id === oid))
      const cmts = comments.filter(c => c.kind === 'supplier' && c.target === name)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const prods = products.filter(p => p.supplier_name === name && myProducts.includes(p.offer_id))
        .sort((a, b) => (lastViewOf(b.offer_id, records)) - (lastViewOf(a.offer_id, records)))
        .slice(0, 20)
        .map(p => ({ offer_id: p.offer_id, title: p.title, main_img_url: p.main_img_url }))
      return { supplier_name: name, comments: cmts, products: prods, comment_count: cmts.length, product_count: myProducts.length }
    })
    const stats = {
      total: list.length,
      commented: list.filter(s => s.comment_count > 0).length,
      totalProducts: list.reduce((sum, s) => sum + s.product_count, 0),
    }
    stats.viewed = stats.total - stats.commented
    if (query.filter === 'commented') list = list.filter(s => s.comment_count > 0)
    else if (query.filter === 'viewed') list = list.filter(s => s.comment_count === 0)
    if (query.search) list = list.filter(s => s.supplier_name.toLowerCase().includes(query.search.toLowerCase()))
    list.sort((a, b) => (a.comment_count > 0 && b.comment_count === 0) ? -1 : (b.comment_count > 0 && a.comment_count === 0) ? 1 : b.product_count - a.product_count)
    const total = list.length
    const pageNum = parseInt(query.page) || 1
    const pageSize = parseInt(query.page_size) || 10
    return ok(list.slice((pageNum - 1) * pageSize, pageNum * pageSize), { total, stats })
  }

  const mSupComments = path === '/api/v1/suppliers/comments'
  if (mSupComments && method === 'GET') {
    return ok(await myComments('supplier', query.supplier_name || ''))
  }
  if (mSupComments && method === 'POST') {
    const c = { id: uid(), kind: 'supplier', target: body.supplier_name, text: body.text, created_at: new Date().toISOString(), updated_at: null }
    await db.put('comments', c)
    if (!(await db.get('suppliers', body.supplier_name))) {
      await db.put('suppliers', { name: body.supplier_name, address: '', memberId: '', created_at: Date.now() })
    }
    await log('POST ' + path, `给供应商「${body.supplier_name}」添加了评论`)
    return ok(c)
  }
  const mSupCommentId = path.match(/^\/api\/v1\/suppliers\/comments\/([^/]+)$/)
  if (mSupCommentId && method === 'PUT') {
    const c = await db.get('comments', mSupCommentId[1])
    if (c) { c.text = body.text; c.updated_at = new Date().toISOString(); await db.put('comments', c) }
    return ok(c)
  }
  if (mSupCommentId && method === 'DELETE') {
    await db.delete('comments', mSupCommentId[1])
    return ok(null)
  }

  // 供应商评论自动保存：有则更新、无则创建、清空则删除  // PUT /api/v1/suppliers/comments/auto?supplier_name=xx
  const mSupCommentAuto = path === '/api/v1/suppliers/comments/auto'
  if (mSupCommentAuto && method === 'PUT') {
    const target = query.supplier_name || ''
    const existing = (await db.all('comments')).find(x => x.kind === 'supplier' && x.target === target)
    const blank = !hasCommentContent(body.text)
    if (blank && existing) { await db.delete('comments', existing.id); return ok(null) }
    if (blank) return ok(null)
    if (existing) {
      existing.text = body.text
      existing.updated_at = new Date().toISOString()
      await db.put('comments', existing)
      return ok(existing)
    }
    const c = { id: uid(), kind: 'supplier', target, text: body.text, created_at: new Date().toISOString(), updated_at: null }
    await db.put('comments', c)
    if (target && !(await db.get('suppliers', target))) {
      await db.put('suppliers', { name: target, address: '', memberId: '', created_at: Date.now() })
    }
    return ok(c)
  }

  // ── 供应商标签接口已移除（标签功能下线）──

  // ── 更新日志 ──
  if (path === '/api/v1/updates' && method === 'GET') {
    const list = await db.all('updates')
    // 合并内置公告：用户已发布同版本号时内置版不重复展示
    const userVersions = new Set(list.map(u => u.version))
    const builtin = BUILTIN_UPDATES.filter(u => !userVersions.has(u.version))
    return ok([...list, ...builtin].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
  }
  if (path === '/api/v1/updates' && method === 'POST') {
    const p = await me()
    const u = {
      id: uid(), version: body.version, title: body.title, content: body.content, status: body.status || 'draft',
      created_by: p.nickname, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    await db.put('updates', u)
    return ok({ id: u.id })
  }
  const mUpdate = path.match(/^\/api\/v1\/updates\/([^/]+)$/)
  if (mUpdate && method === 'PUT') {
    const u = await db.get('updates', mUpdate[1])
    if (!u) return { code: 404, message: '不存在' }
    const p = await me()
    Object.assign(u, body, { updated_by: p.nickname, updated_at: new Date().toISOString() })
    await db.put('updates', u)
    return ok(u)
  }
  if (mUpdate && method === 'DELETE') {
    await db.delete('updates', mUpdate[1])
    return ok(null)
  }

  // ── 操作日志 ──
  if (path === '/api/v1/operations/logs' && method === 'GET') {
    const list = (await db.all('operation_logs')).sort((a, b) => b.created_at - a.created_at)
    const total = list.length
    const pageNum = parseInt(query.page) || 1
    const pageSize = parseInt(query.page_size) || 20
    const page = list.slice((pageNum - 1) * pageSize, pageNum * pageSize)
      .map(l => ({ ...l, username: '我', created_at: new Date(l.created_at).toLocaleString('zh-CN', { hour12: false }) }))
    return ok(page, { total })
  }

  return { code: 404, message: '本地接口未实现: ' + method + ' ' + path }
}

function lastViewOf(offer_id, records) {
  let t = 0
  for (const r of records) if (r.offer_id === offer_id && r.viewed_at > t) t = r.viewed_at
  return t
}

function cmtsTextHas(offer_id, search, comments) {
  return comments.some(c => c.kind === 'product' && c.target === offer_id && c.text && c.text.includes(search))
}

// 评论内容是否为空（纯文本为空且不含图片）
function hasCommentContent(html) {
  if (!html) return false
  const text = String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return !!text || /<img[^>]+src=/.test(html)
}

// 内置版本更新公告（与用户在 UpdateEditor 中手动发布的记录合并展示）
const BUILTIN_UPDATES = [
  {
    id: 'builtin-0.4.2', version: '0.4.2', title: '浏览时间轴与同步方式设置', status: 'published',
    created_at: '2026-09-27T15:00:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>数据页新增「浏览时间轴」：谁在什么时候浏览了商品一目了然，旧在上、新在下，滚到底部自动刷新</li>'
      + '<li>同步方式可设置：自动同步（间隔可选 1/3/5/10/15 分钟）或仅手动，修改立即生效</li>'
      + '<li>修复团队成员笔记内容贴边的问题，已加左间距与编辑器对齐</li>'
      + '</ul>',
  },
  {
    id: 'builtin-0.4.1', version: '0.4.1', title: '修复跨电脑评论不显示', status: 'published',
    created_at: '2026-09-27T12:30:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>修复另一台电脑发表的商品/供应商评论在本机不显示的问题：远程评论时间为时间戳，排序时误用字符串方法导致接口报错</li>'
      + '<li>列表卡片的团队留言与他人计数同步恢复正常</li>'
      + '</ul>',
  },
  {
    id: 'builtin-0.4.0', version: '0.4.0', title: '多人共享版上线', status: 'published',
    created_at: '2026-09-28T10:00:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>新增多人共享模式：设置页填写服务器地址与昵称即可连接，不填仍为单机模式</li>'
      + '<li>同意「共享我的数据」后，笔记与浏览流水上传服务器，每 5 分钟自动同步，也可手动同步</li>'
      + '<li>三个展示开关：是否显示他人笔记、是否显示他人浏览数量、是否在列表页显示，随心控制</li>'
      + '<li>商品/供应商详情页可查看团队成员笔记，数据页趋势图叠加他人曲线</li>'
      + '<li>列表卡片新增「跳转商品」链接，没有链接的商品也能一键打开详情页</li>'
      + '</ul>',
  },
  {
    id: 'builtin-0.3.2', version: '0.3.2', title: '商品行新增一键跳转', status: 'published',
    created_at: '2026-09-27T15:00:00.000Z', created_by: 'Conley',
    content: '<ul><li>「我的货源」商品行新增「跳转商品」按钮，点击直接打开 1688 详情页，无链接的商品也能凭商品编号跳转</li></ul>',
  },
  {
    id: 'builtin-0.3.1', version: '0.3.1', title: '货源页改为左右分栏布局', status: 'published',
    created_at: '2026-09-27T14:00:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>「我的货源」改为左右分栏：左侧供应商列表（有笔记自动置顶），点击后右侧以行列表展示该供应商的全部商品</li>'
      + '<li>商品不再使用网格方框，每行展示图片、标题、笔记摘要、出现与浏览次数，信息一眼看清</li>'
      + '<li>点击商品从右侧滑出详情面板：评论、浏览/出现次数、每日记录与浏览时间线</li>'
      + '</ul>',
  },
  {
    id: 'builtin-0.3.0', version: '0.3.0', title: '我的货源合并页 · 删除与批量管理', status: 'published',
    created_at: '2026-09-27T12:00:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>商品管理与供应商管理合并为「我的货源」：以供应商分组、手风琴展开，有笔记的供应商和商品自动置顶，不用再翻页查找</li>'
      + '<li>新增单个删除与批量管理：商品、供应商均可删除，关联的浏览记录、出现记录、笔记连带清除（删除前二次确认）</li>'
      + '<li>商品详情抽屉：出现/浏览/笔记总数、首次与最近浏览时间、近 30 天每日记录、每次浏览的精确时间线一目了然</li>'
      + '<li>列表卡片图表优化为上下双图（出现面积趋势 + 浏览时间柱），固定近 30 天，去除被遮挡的悬浮切换条</li>'
      + '<li>下线已失效的「box1 图表样式」设置项</li>'
      + '</ul>',
  },
  {
    id: 'builtin-0.2.2', version: '0.2.2', title: '链接净化 · 自动保存笔记 · 数据统计页', status: 'published',
    created_at: '2026-09-27T00:00:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>新增「净化详情页链接」：进入商品详情页自动去除链接后缀参数，页面右侧出现悬浮按钮，一键复制干净链接（可在设置中开关）</li>'
      + '<li>商品/供应商评论改为「自动保存笔记」：打开即编辑，停顿自动保存，再次进入自动恢复，清空内容即自动删除</li>'
      + '<li>新增「数据」页：出现/浏览趋势折线图（支持 7/14/30 天切换）、24 小时浏览时段分布、同店已看商品等统计</li>'
      + '<li>优化商品管理、供应商管理布局：顶部统计卡片可直接点击筛选，已看/有笔记状态一目了然</li>'
      + '<li>整体下线标签功能；精简评论工具栏为加粗、斜体、插入图片、全屏</li>'
      + '</ul>',
  },
  {
    id: 'builtin-0.2.1', version: '0.2.1', title: '弹窗显示优化', status: 'published',
    created_at: '2026-09-16T00:00:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>修复工具栏弹窗尺寸写死导致大片空白的问题，窗口随内容自适应</li>'
      + '<li>优化弹窗在 1688 各页面下的显示效果</li>'
      + '</ul>',
  },
  {
    id: 'builtin-0.2.0', version: '0.2.0', title: '单机版发布', status: 'published',
    created_at: '2026-09-10T00:00:00.000Z', created_by: 'Conley',
    content: '<ul>'
      + '<li>单机版发布：全部数据保存在浏览器本地（IndexedDB），无需登录、无需服务器</li>'
      + '<li>支持商品评论、供应商评论、商品浏览与列表出现记录</li>'
      + '<li>支持数据导出备份与导入迁移</li>'
      + '</ul>',
  },
]

/**
 * 统一入口：解析 path 上的 query，分发给路由
 * 返回与原后端一致的结构 { code, data, ... }
 */
export async function handle(pathWithQuery, method = 'GET', body = undefined) {
  const [path, qs] = pathWithQuery.split('?')
  const query = {}
  if (qs) for (const [k, v] of new URLSearchParams(qs)) query[k] = v
  try {
    return await route(path, method.toUpperCase(), body, query)
  } catch (e) {
    console.error('[localapi]', method, path, e)
    return { code: 500, message: '本地数据操作失败', error: e.message }
  }
}
