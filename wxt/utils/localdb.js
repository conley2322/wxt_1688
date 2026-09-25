// localdb.js — 单机版本地数据库（IndexedDB）
// 所有业务数据存在浏览器 IndexedDB，无需任何后端。
// 存储用量显示 / 软上限自动清理 / JSON 导入导出 都在这里。

const DB_NAME = 'alocs-local'
const DB_VERSION = 2 // v2: 新增 appear_records（出现次数流水）

// store 名 → keyPath（null 表示自增主键）
export const STORES = {
  profile: null,        // key 'me'：{ nickname, avatar_color }
  products: 'offer_id', // { offer_id, title, main_img_url, supplier_name, created_at }
  view_records: null,   // 自增 { offer_id, viewed_at } — 详情页浏览记录
  appear_records: null, // 自增 { offer_id, appeared_at } — 列表页出现记录（组件渲染即 +1）
  suppliers: 'name',    // { name, address, memberId, created_at }
  comments: 'id',       // { id, kind:'product'|'supplier', target, text, created_at, updated_at }
  tags: 'id',           // { id, text, font_color, bg_color, creator, created_at }
  tag_assign: 'id',     // { id, tag_id, kind:'product'|'supplier', target, assigned_at }
  updates: 'id',        // { id, version, title, content, status, created_by, created_at, updated_at }
  operation_logs: null, // 自增 { action, detail, created_at }
}

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, keyPath ? { keyPath } : { autoIncrement: true })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    const out = fn(s)
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out)
    t.onerror = () => reject(t.error)
  }))
}

// 请求包装：把 IDBRequest 变 Promise
function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export const db = {
  get: (store, key) => openDB().then(d => req(d.transaction(store).objectStore(store).get(key))),
  all: (store) => openDB().then(d => req(d.transaction(store).objectStore(store).getAll())),
  count: (store) => openDB().then(d => req(d.transaction(store).objectStore(store).count())),
  // 无 keyPath 的 store（profile）必须显式传 key；有 keyPath 的传 value 即可
  put: (store, value, key) => openDB().then(d => {
    const s = d.transaction(store, 'readwrite').objectStore(store)
    return req(key !== undefined ? s.put(value, key) : s.put(value))
  }),
  add: (store, value) => openDB().then(d => req(d.transaction(store, 'readwrite').objectStore(store).add(value))),
  delete: (store, key) => openDB().then(d => req(d.transaction(store, 'readwrite').objectStore(store).delete(key))),
  clear: (store) => openDB().then(d => req(d.transaction(store, 'readwrite').objectStore(store).clear())),
}

export function uid() {
  return crypto.randomUUID()
}

// ════════════════════════════════════
// 个人资料（单用户，无账号体系）
// ════════════════════════════════════
export const DEFAULT_PROFILE = { nickname: '我', avatar_color: '#8a8f99' } // 通用灰头像

export async function getProfile() {
  let p = await db.get('profile', 'me')
  if (!p) {
    p = { nickname: DEFAULT_PROFILE.nickname, avatar_color: DEFAULT_PROFILE.avatar_color }
    await db.put('profile', p, 'me')
  }
  return p
}

export async function saveProfile(patch) {
  const p = { ...(await getProfile()), ...patch }
  await db.put('profile', p, 'me')
  return p
}

// ════════════════════════════════════
// 存储用量 + 自动清理
// ════════════════════════════════════
export async function storageInfo() {
  let browserUsage = 0
  let browserQuota = 0
  try {
    const est = await navigator.storage.estimate()
    browserUsage = est.usage || 0
    browserQuota = est.quota || 0
  } catch (e) { /* 不支持则忽略 */ }

  const counts = {}
  for (const name of Object.keys(STORES)) {
    counts[name] = await db.count(name)
  }
  return {
    usageBytes: browserUsage,
    usageMB: +(browserUsage / 1024 / 1024).toFixed(2),
    quotaBytes: browserQuota,
    quotaMB: +(browserQuota / 1024 / 1024).toFixed(0),
    counts,
  }
}

export async function getQuotaMB() {
  const stored = await browser.storage.local.get('localQuotaMB')
  return stored.localQuotaMB ?? 100 // 默认软上限 100MB
}

export async function setQuotaMB(mb) {
  await browser.storage.local.set({ localQuotaMB: Math.max(10, +mb || 100) })
}

// 超过软上限时清理：只清"流水"数据（浏览记录，最旧的先删），评论/标签等创作数据永不自动清
export async function cleanupIfNeeded() {
  const quotaMB = await getQuotaMB()
  let info = await storageInfo()
  if (info.usageMB < quotaMB) return { cleaned: false, ...info }

  let deleted = 0
  // 流水数据（浏览记录 + 出现记录）都按最旧优先清理，评论/标签等创作数据永不自动清
  const flowStores = ['view_records', 'appear_records']
  for (const store of flowStores) {
    while (info.usageMB >= quotaMB * 0.8) {
      const { keys, rows } = await getAllWithKeys(store)
      if (rows.length === 0) break
      const timeKey = store === 'view_records' ? 'viewed_at' : 'appeared_at'
      const ordered = rows
        .map((row, i) => ({ key: keys[i], ts: row[timeKey] }))
        .sort((a, b) => a.ts - b.ts)
      const batch = ordered.slice(0, Math.min(500, ordered.length))
      for (const r of batch) await db.delete(store, r.key)
      deleted += batch.length
      info = await storageInfo()
    }
  }
  return { cleaned: true, deleted, ...info }
}

// ════════════════════════════════════
// 导入 / 导出（迁移，对齐 time-tracker 的模式）
// 键值成对导出，保证自增主键 store（浏览记录/操作日志/资料）迁移后数据不变
// ════════════════════════════════════
async function getAllWithKeys(store) {
  const d = await openDB()
  return new Promise((resolve, reject) => {
    const t = d.transaction(store)
    const s = t.objectStore(store)
    const keysReq = s.getAllKeys()
    const rowsReq = s.getAll()
    let keys, rows
    keysReq.onsuccess = () => { keys = keysReq.result; if (rows) done() }
    rowsReq.onsuccess = () => { rows = rowsReq.result; if (keys) done() }
    function done() { resolve({ keys, rows }) }
    t.onerror = () => reject(t.error)
  })
}

export async function exportData() {
  const data = { _meta: { app: 'ALOCS-1688-standalone', exportedAt: new Date().toISOString(), version: 1 } }
  for (const name of Object.keys(STORES)) {
    data[name] = await getAllWithKeys(name)
  }
  return data
}

// mode: 'merge' 合并（同 key 覆盖）| 'replace' 清空后导入
export async function importData(data, mode = 'merge') {
  if (!data || data._meta?.app !== 'ALOCS-1688-standalone') {
    throw new Error('不是有效的 ALOCS 单机版备份文件')
  }
  if (mode === 'replace') {
    for (const name of Object.keys(STORES)) await db.clear(name)
  }
  for (const [name, bundle] of Object.entries(data)) {
    if (name === '_meta' || !(name in STORES) || !bundle || !bundle.rows) continue
    const isOutOfLine = STORES[name] === null // 自增主键 store：必须显式传键
    for (let i = 0; i < bundle.rows.length; i++) {
      if (isOutOfLine) {
        const key = bundle.keys?.[i]
        if (key !== undefined) await db.put(name, bundle.rows[i], key)
        else await db.add(name, bundle.rows[i])
      } else {
        await db.put(name, bundle.rows[i])
      }
    }
  }
  return storageInfo()
}
