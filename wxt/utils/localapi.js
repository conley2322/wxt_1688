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

async function myTagsFor(kind, target) {
  const [assigns, tags] = await Promise.all([db.all('tag_assign'), db.all('tags')])
  return assigns
    .filter(a => a.kind === kind && a.target === target)
    .map(a => tags.find(t => t.id === a.tag_id))
    .filter(Boolean)
    .map(t => ({ id: t.id, text: t.text, font_color: t.font_color, bg_color: t.bg_color }))
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
  if (path === '/api/v1/products/batch_info' && method === 'POST') {
    const [products, records, comments, assigns] = await Promise.all([
      db.all('products'), db.all('view_records'), db.all('comments'), db.all('tag_assign'),
    ])
    const result = {}
    for (const offer_id of body.offer_ids) {
      const p = products.find(x => x.offer_id === offer_id)
      if (!p) continue
      const views = records.filter(r => r.offer_id === offer_id)
      const cmts = comments.filter(c => c.kind === 'product' && c.target === offer_id)
      const tags = assigns.filter(a => a.kind === 'product' && a.target === offer_id)
      // 最近 14 天按天聚合的浏览次数（box1 时间折线图数据源）
      const timeline = []
      const today = new Date(); today.setHours(0, 0, 0, 0)
      for (let i = 13; i >= 0; i--) {
        const dayStart = today.getTime() - i * DAY
        const label = `${String(new Date(dayStart).getMonth() + 1).padStart(2, '0')}-${String(new Date(dayStart).getDate()).padStart(2, '0')}`
        timeline.push({ date: label, count: views.filter(v => v.viewed_at >= dayStart && v.viewed_at < dayStart + DAY).length })
      }
      result[offer_id] = {
        view_count: views.length,
        comment_count: cmts.length,
        tag_count: tags.length,
        i_have_viewed: views.length > 0,
        last_viewed_at: views.length ? Math.max(...views.map(v => v.viewed_at)) : null,
        my_views_timeline: timeline,
      }
    }
    return ok(result)
  }

  // ── 商品列表（管理后台）──
  if (path === '/api/v1/products/mine' && method === 'GET') {
    const pageNum = parseInt(query.page) || 1
    const pageSize = parseInt(query.page_size) || 20
    let products = await db.all('products')
    const [records, comments, assigns] = await Promise.all([db.all('view_records'), db.all('comments'), db.all('tag_assign')])
    const lastView = {}
    for (const r of records) lastView[r.offer_id] = Math.max(lastView[r.offer_id] || 0, r.viewed_at)
    // 只显示我浏览过的商品（对齐原版语义）
    let list = products.filter(p => lastView[p.offer_id])
    if (query.tag_id) {
      list = list.filter(p => assigns.some(a => a.kind === 'product' && a.target === p.offer_id && a.tag_id === query.tag_id))
    }
    let result = list.map(p => {
      const cmts = comments.filter(c => c.kind === 'product' && c.target === p.offer_id)
      return {
        ...p,
        tags: assigns
          .filter(a => a.kind === 'product' && a.target === p.offer_id)
          .map(a => ({ tag_id: a.tag_id })),
        my_comment: (cmts[0] || {}).text || null,
        comment_count: cmts.length,
        view_count: (lastView[p.offer_id] ? records.filter(r => r.offer_id === p.offer_id).length : 0),
      }
    })
    // 附加标签详情
    const tags = await db.all('tags')
    result = result.map(r => ({
      ...r,
      tags: r.tags.map(t => {
        const tag = tags.find(x => x.id === t.tag_id)
        return tag ? { id: tag.id, text: tag.text, font_color: tag.font_color, bg_color: tag.bg_color } : null
      }).filter(Boolean),
    }))
    if (query.search && query.search_type === 'title') {
      result = result.filter(p => p.title && p.title.includes(query.search))
    }
    if (query.search && query.search_type === 'comment') {
      result = result.filter(p => cmtsTextHas(p.offer_id, query.search, comments))
    }
    if (query.sort_by === 'view_count') {
      result.sort((a, b) => query.sort_order === 'asc' ? a.view_count - b.view_count : b.view_count - a.view_count)
    } else if (query.sort_by === 'comment_count') {
      result.sort((a, b) => query.sort_order === 'asc' ? a.comment_count - b.comment_count : b.comment_count - a.comment_count)
    } else {
      result.sort((a, b) => (lastView[b.offer_id] || 0) - (lastView[a.offer_id] || 0))
    }
    const total = result.length
    return ok(result.slice((pageNum - 1) * pageSize, pageNum * pageSize), { total })
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

  // ── 商品标签 ──
  const mProductTags = path.match(/^\/api\/v1\/products\/([^/]+)\/tags$/)
  if (mProductTags && method === 'GET') {
    const mine = await myTagsFor('product', decodeURIComponent(mProductTags[1]))
    return ok({ mine, others: [] })
  }
  if (mProductTags && method === 'POST') {
    const target = decodeURIComponent(mProductTags[1])
    await db.put('tag_assign', { id: uid(), tag_id: body.tag_id, kind: 'product', target, assigned_at: Date.now() })
    return ok(null)
  }
  const mProductTagDel = path.match(/^\/api\/v1\/products\/([^/]+)\/tags\/([^/]+)$/)
  if (mProductTagDel && method === 'DELETE') {
    const target = decodeURIComponent(mProductTagDel[1])
    const assigns = await db.all('tag_assign')
    for (const a of assigns.filter(a => a.kind === 'product' && a.target === target && a.tag_id === mProductTagDel[2])) {
      await db.delete('tag_assign', a.id)
    }
    return ok(null)
  }

  // ── 标签池 ──
  if (path === '/api/v1/tags/pool' && method === 'GET') {
    const list = await db.all('tags')
    return ok(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
  }
  if (path === '/api/v1/tags' && method === 'POST') {
    const p = await me()
    const t = {
      id: uid(), text: body.text,
      font_color: body.font_color || '#fff', bg_color: body.bg_color || '#1677ff',
      creator: p.nickname, created_at: new Date().toISOString(),
    }
    await db.put('tags', t)
    await log('POST /api/v1/tags', `创建了标签「${t.text}」`)
    return ok(t)
  }
  const mTag = path.match(/^\/api\/v1\/tags\/([^/]+)$/)
  if (mTag && method === 'PUT') {
    const t = await db.get('tags', mTag[1])
    if (t) { Object.assign(t, body); await db.put('tags', t) }
    return ok(t)
  }
  if (mTag && method === 'DELETE') {
    const assigns = await db.all('tag_assign')
    for (const a of assigns.filter(a => a.tag_id === mTag[1])) await db.delete('tag_assign', a.id)
    await db.delete('tags', mTag[1])
    await log('DELETE ' + path, '删除了标签')
    return ok(null)
  }

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

  const mSupTags = path === '/api/v1/suppliers/tags'
  if (mSupTags && method === 'GET') {
    const mine = await myTagsFor('supplier', query.supplier_name || '')
    return ok({ mine, others: [] })
  }
  if (mSupTags && method === 'POST') {
    await db.put('tag_assign', { id: uid(), tag_id: body.tag_id, kind: 'supplier', target: body.supplier_name, assigned_at: Date.now() })
    return ok(null)
  }
  const mSupTagDel = path.match(/^\/api\/v1\/suppliers\/tags\/([^/]+)$/)
  if (mSupTagDel && method === 'DELETE') {
    const assigns = await db.all('tag_assign')
    for (const a of assigns.filter(a => a.kind === 'supplier' && a.target === query.supplier_name && a.tag_id === mSupTagDel[1])) {
      await db.delete('tag_assign', a.id)
    }
    return ok(null)
  }

  // ── 更新日志 ──
  if (path === '/api/v1/updates' && method === 'GET') {
    const list = await db.all('updates')
    return ok(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
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
