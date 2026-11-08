// aiSearch.js — 本地检索索引（RAG 的 Retrieve 环节）
// 数据越来越多时不把全量内容塞给模型：先用 BM25 检索（MiniSearch，开源）
// 找出与问题最相关的供应商 / 商品 / 聊天片段，再把这些片段交给 AI 分析。
// 索引只存在内存里，数据仍全部留在本机 IndexedDB。

import MiniSearch from 'minisearch'
import { db } from './localdb.js'
import { classifyChat } from './chatFilter.js'
import { stripHtml } from './factoryInfo.js'

const MAX_CHAT_PER_SUPPLIER = 300
const MAX_CHAT_TOTAL = 12000

let cache = null
const CACHE_TTL = 5 * 60 * 1000

export function invalidateAiIndex() {
  cache = null
}

// ── 中文分词：单字 + 二元组（不依赖词典，检索召回稳定）──
const CJK_RUN = /[\u4e00-\u9fa5]+/g
const ASCII_RUN = /[a-z0-9]+/gi

function cjkBigrams(run, withUnigrams) {
  const out = []
  if (withUnigrams) for (const ch of run) out.push(ch)
  for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2))
  if (run.length === 1 && !withUnigrams) out.push(run)
  return out
}

function tokenizeIndex(text) {
  const s = String(text || '').toLowerCase()
  const out = []
  for (const m of s.matchAll(CJK_RUN)) out.push(...cjkBigrams(m[0], true))
  for (const m of s.matchAll(ASCII_RUN)) out.push(m[0])
  return out
}

function tokenizeQuery(text) {
  const s = String(text || '').toLowerCase()
  const out = []
  for (const m of s.matchAll(CJK_RUN)) out.push(...cjkBigrams(m[0], false))
  for (const m of s.matchAll(ASCII_RUN)) out.push(m[0])
  return out
}

function plain(html) {
  return stripHtml(String(html || '')).replace(/\s+/g, ' ').trim()
}

// 采购场景同义词扩展：用户问「多少钱」时也能命中写着「报价/单价」的记录
const SYNONYM_GROUPS = [
  ['价格', '多少钱', '报价', '单价', '最低价', '便宜'],
  ['起订', '起批', 'moq', '一件代发', '拿货'],
  ['交期', '发货', '几天', '多久', '现货'],
  ['定制', '打样', '样衣', 'logo', '贴牌'],
  ['质量', '做工', '面料', '克重', '材质'],
  ['认证', '检测', '资质', '证书'],
]

function expandQuery(q) {
  const lower = q.toLowerCase()
  const extra = []
  for (const group of SYNONYM_GROUPS) {
    if (group.some(t => lower.includes(t))) extra.push(...group)
  }
  return extra.length ? `${q} ${extra.join(' ')}` : q
}

function archiveFields(archive) {
  const a = archive || {}
  return [
    a['经营模式'], a['交易方式'], a['认证信息'], a['厂房面积'], a['员工人数'], a['主营产品'], a['主营行业'],
  ].filter(Boolean).map(String)
}

function aggregate(products, records) {
  const viewCount = {}
  const lastView = {}
  for (const r of records) {
    viewCount[r.offer_id] = (viewCount[r.offer_id] || 0) + 1
    lastView[r.offer_id] = Math.max(lastView[r.offer_id] || 0, r.viewed_at)
  }
  const map = new Map()
  for (const p of products) {
    if (!viewCount[p.offer_id]) continue
    const name = p.supplier_name || '未知供应商'
    let s = map.get(name)
    if (!s) {
      s = { name, product_count: 0, view_count: 0, last_view_at: null, products: [] }
      map.set(name, s)
    }
    s.product_count++
    s.view_count += viewCount[p.offer_id]
    s.last_view_at = Math.max(s.last_view_at || 0, lastView[p.offer_id] || 0)
    s.products.push({ offer_id: p.offer_id, title: p.title || '', view: viewCount[p.offer_id] })
  }
  for (const s of map.values()) s.products.sort((a, b) => b.view - a.view)
  return map
}

async function rebuild() {
  const [products, records, chats, comments, suppliers] = await Promise.all([
    db.all('products'), db.all('view_records'), db.all('chat_messages'), db.all('comments'), db.all('suppliers'),
  ])
  const supMap = aggregate(products, records)
  const archiveByName = new Map(suppliers.map(s => [s.name, s]))
  const notesBySupplier = new Map()
  for (const c of comments) {
    if (c.kind !== 'supplier' || !c.target) continue
    if (!notesBySupplier.has(c.target)) notesBySupplier.set(c.target, [])
    notesBySupplier.get(c.target).push(plain(c.text))
  }

  // 聊天：按供应商归组 + 过滤噪音，超量时保留较新的
  const chatBySupplier = new Map()
  for (const m of chats) {
    const key = m.supplier_name || m.display_name || m.login_id
    if (!key) continue
    if (!chatBySupplier.has(key)) chatBySupplier.set(key, [])
    chatBySupplier.get(key).push(m)
  }
  const keptChats = new Map()
  for (const [name, list] of chatBySupplier) {
    const { messages } = classifyChat(list)
    keptChats.set(name, messages.slice(-MAX_CHAT_PER_SUPPLIER))
  }
  // 全局限量：按时间取较新的聊天建立索引
  const allKept = []
  for (const [name, list] of keptChats) for (const m of list) allKept.push({ name, m })
  allKept.sort((a, b) => (b.m.ts || 0) - (a.m.ts || 0))
  const chatDocs = []
  const seenChat = new Set()
  for (const { name, m } of allKept.slice(0, MAX_CHAT_TOTAL)) {
    if (seenChat.has(m.id)) continue
    seenChat.add(m.id)
    chatDocs.push({
      id: `c:${m.id}`,
      kind: 'chat',
      name: '',
      supplier: name,
      text: String(m.text || '').slice(0, 400) || ((m.images || []).length ? '[图片]' : '[商品卡片]'),
      ts: m.ts || 0,
      sender: m.sender || '',
      nick: m.nick || '',
    })
  }

  // 供应商文档：档案字段 + 备注 + 商品标题 + 近期聊天
  const names = new Set([...supMap.keys(), ...archiveByName.keys(), ...notesBySupplier.keys(), ...keptChats.keys()])
  const supplierDocs = []
  const meta = {}
  for (const name of names) {
    if (!name) continue
    const agg = supMap.get(name) || { product_count: 0, view_count: 0, last_view_at: 0, products: [] }
    const sup = archiveByName.get(name)
    const archive = sup?.archive_info || {}
    const notes = (notesBySupplier.get(name) || []).slice(0, 5)
    const kept = keptChats.get(name) || []
    // 供应商文档只放少量近期聊天用于召回；完整聊天片段由独立文档提供
    const recentChatText = kept.slice(-30).map(m => m.text || '').join(' ').slice(0, 800)
    const text = [
      name,
      ...(sup?.loginIds || []),
      ...archiveFields(archive),
      ...notes,
      ...agg.products.slice(0, 60).map(p => p.title),
      recentChatText,
    ].filter(Boolean).join(' ')
    supplierDocs.push({ id: `s:${name}`, kind: 'supplier', name, supplier: name, text, ts: Math.max(agg.last_view_at || 0, kept[kept.length - 1]?.ts || 0) })
    meta[name] = {
      name,
      product_count: agg.product_count,
      view_count: agg.view_count,
      last_view_at: agg.last_view_at || 0,
      last_chat_ts: kept[kept.length - 1]?.ts || 0,
      archive: {
        model: archive['经营模式'] || '',
        trade: archive['交易方式'] || '',
        cert: archive['认证信息'] || '',
        employees: archive['员工人数'] || '',
        area: archive['厂房面积'] || '',
        year: sup?.year || '',
      },
      top_products: agg.products.slice(0, 5).map(p => p.title).filter(Boolean),
    }
  }

  // 商品文档：标题直接参与检索，命中后可归到供应商
  const viewOf = {}
  for (const r of records) viewOf[r.offer_id] = (viewOf[r.offer_id] || 0) + 1
  const productDocs = products
    .filter(p => p.title)
    .sort((a, b) => (viewOf[b.offer_id] || 0) - (viewOf[a.offer_id] || 0))
    .slice(0, 5000)
    .map(p => ({
      id: `p:${p.offer_id}`,
      kind: 'product',
      name: p.title,
      supplier: p.supplier_name || '未知供应商',
      text: `${p.title} ${p.offer_id}`,
      ts: 0,
      sender: '',
      nick: '',
    }))

  const ms = new MiniSearch({
    fields: ['name', 'text'],
    storeFields: ['kind', 'name', 'supplier', 'text', 'ts', 'sender', 'nick'],
    tokenize: tokenizeIndex,
    processTerm: t => t.toLowerCase(),
  })
  ms.addAll([...supplierDocs, ...chatDocs, ...productDocs])

  cache = {
    ms,
    meta,
    indexed: { suppliers: supplierDocs.length, chats: chatDocs.length, products: productDocs.length },
    built_at: Date.now(),
  }
  return cache
}

export async function ensureIndex() {
  if (cache && Date.now() - cache.built_at < CACHE_TTL) return cache
  return rebuild()
}

// 检索相关供应商；返回带聊天片段/命中商品的结果
export async function retrieveSuppliers(question, limit = 6) {
  const q = String(question || '').trim()
  if (!q) return { hits: [], indexed: (await ensureIndex()).indexed }
  const idx = await ensureIndex()
  const searchText = expandQuery(q)
  let raw = []
  try {
    raw = idx.ms.search(searchText, {
      tokenize: tokenizeQuery,
      combineWith: 'OR',
      prefix: true,
      fuzzy: 0.2,
      limit: 120,
    })
  } catch { raw = [] }

  const grouped = new Map()
  for (const r of raw) {
    const name = r.kind === 'supplier' ? r.name : r.supplier
    if (!name) continue
    let h = grouped.get(name)
    if (!h) {
      h = { name, score: 0, snippets: [], matched_products: [] }
      grouped.set(name, h)
    }
    if (r.kind === 'supplier') {
      h.score += r.score
    } else if (r.kind === 'chat') {
      h.score += r.score * 0.7
      if (h.snippets.length < 3 && !h.snippets.some(s => s.text === r.text)) {
        h.snippets.push({ text: r.text, ts: r.ts, sender: r.sender, nick: r.nick })
      }
    } else if (r.kind === 'product') {
      h.score += r.score * 0.55
      if (h.matched_products.length < 3 && !h.matched_products.includes(r.name)) {
        h.matched_products.push(r.name)
      }
    }
  }

  const list = [...grouped.values()].sort((a, b) => b.score - a.score)
  const top = list[0]?.score || 0
  const hits = list
    .filter(h => h.score >= top * 0.12)
    .slice(0, Math.max(1, Math.min(limit, 12)))
    .map(h => {
      const m = idx.meta[h.name] || { name: h.name, product_count: 0, view_count: 0, archive: {}, top_products: [] }
      return {
        ...h,
        product_count: m.product_count,
        view_count: m.view_count,
        last_view_at: m.last_view_at,
        last_chat_ts: m.last_chat_ts,
        archive: m.archive,
        top_products: m.top_products,
        snippets: h.snippets.sort((a, b) => (b.ts || 0) - (a.ts || 0)),
      }
    })
  return { hits, indexed: idx.indexed }
}
