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
    const [products, records, comments, appears] = await Promise.all([
      db.all('products'), db.all('view_records'), db.all('comments'), db.all('appear_records'),
    ])
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
      // 最近 14 天按天聚合（box1 双折线图数据源：出现 + 浏览）
      const timeline = []
      const today = new Date(); today.setHours(0, 0, 0, 0)
      for (let i = 13; i >= 0; i--) {
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

      result[offer_id] = {
        appear_count: apps.length,
        view_count: views.length,
        comment_count: cmts.length,
        i_have_viewed: views.length > 0,
        last_viewed_at: views.length ? Math.max(...views.map(v => v.viewed_at)) : null,
        my_views_timeline: timeline,
        supplier_name: supplierName,
        supplier_viewed_count: supplierViewedCount,
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

  // ── 商品数据统计 ──  // GET /api/v1/products/:id/stats
  const mProductStats = path.match(/^\/api\/v1\/products\/([^/]+)\/stats$/)
  if (mProductStats && method === 'GET') {
    const offer_id = decodeURIComponent(mProductStats[1])
    const [products, records, comments, appears] = await Promise.all([
      db.all('products'), db.all('view_records'), db.all('comments'), db.all('appear_records'),
    ])
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
      supplier_name: supplierName,
      supplier_viewed_count: supplierViewedCount,
      daily,
      hourly,
    })
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
