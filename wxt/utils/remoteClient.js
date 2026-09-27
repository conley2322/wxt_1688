// remoteClient.js — 多人共享同步层
// 配置存 browser.storage.local：
//   serverAddress  服务器地址（空 = 单机模式）
//   token          客户端身份令牌（本机生成的 UUID，昵称免注册）
//   nickname       昵称
//   shareEnabled   是否同意共享我的数据
//   multiSettings  { showOthersComments, showOthersViews, showOnListPage } 三个展示开关
//   syncMode       'auto'=按间隔自动同步 | 'manual'=仅手动同步
//   syncInterval   自动同步间隔（分钟）：1 / 3 / 5 / 10 / 15
//   syncState      流水增量水位 + 最近同步时间
import { db, getAllWithKeys } from './localdb.js'

const DEFAULT_MULTI = { showOthersComments: true, showOthersViews: true, showOnListPage: true }
export const SYNC_INTERVALS = [1, 3, 5, 10, 15]

function normalizeAddress(addr) {
  return String(addr || '').trim().replace(/\/+$/, '')
}

export async function getRemoteConfig() {
  const s = await browser.storage.local.get(
    ['serverAddress', 'token', 'nickname', 'shareEnabled', 'multiSettings', 'syncMode', 'syncInterval', 'syncState']
  )
  return {
    serverAddress: normalizeAddress(s.serverAddress),
    token: s.token || '',
    nickname: s.nickname || '',
    shareEnabled: s.shareEnabled === true,
    multiSettings: { ...DEFAULT_MULTI, ...(s.multiSettings || {}) },
    syncMode: s.syncMode === 'manual' ? 'manual' : 'auto',
    syncInterval: SYNC_INTERVALS.includes(s.syncInterval) ? s.syncInterval : 5,
    syncState: s.syncState || { view_last_key: 0, appear_last_key: 0, last_push_at: 0, last_pull_at: 0 },
  }
}

export async function saveRemoteConfig(patch) {
  await browser.storage.local.set(patch)
}

// 身份令牌由本机生成（首次使用时）
export async function ensureToken() {
  const { token } = await getRemoteConfig()
  if (token) return token
  const next = crypto.randomUUID()
  await saveRemoteConfig({ token: next })
  return next
}

async function http(cfg, path, method, body) {
  const res = await fetch(cfg.serverAddress + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-client-token': cfg.token },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.code !== 200) throw new Error(json.message || `服务器响应 ${res.status}`)
  return json
}

// 测试服务器是否在线（健康检查）
export async function testConnection(address) {
  const url = normalizeAddress(address)
  const res = await fetch(url + '/')
  const json = await res.json().catch(() => null)
  if (!json || json.code !== 200) throw new Error('不是有效的 ALOCS 服务器，请检查地址')
  return json.data
}

// 连接服务器并注册昵称，成功后立即同步一次
export async function connectAndRegister(address, nickname) {
  const serverAddress = normalizeAddress(address)
  const name = String(nickname || '').trim()
  if (!/^https?:\/\/\S+/.test(serverAddress)) throw new Error('请填写 http:// 或 https:// 开头的完整地址（含端口）')
  if (!name) throw new Error('请填写昵称')
  await testConnection(serverAddress)
  const token = await ensureToken()

  const res = await fetch(serverAddress + '/api/v1/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-token': token },
    body: JSON.stringify({ nickname: name }),
  }).then(r => r.json())
  if (res.code !== 200) throw new Error(res.message || '注册失败')

  await saveRemoteConfig({ serverAddress, nickname: name })
  return syncOnce()
}

// 更新昵称（重新注册）
export async function updateNickname(name) {
  const cfg = await getRemoteConfig()
  if (!cfg.serverAddress) throw new Error('尚未连接服务器')
  const nickname = String(name || '').trim()
  if (!nickname) throw new Error('昵称不能为空')
  await http(cfg, '/api/v1/clients', 'POST', { nickname })
  await saveRemoteConfig({ nickname })
}

// 断开连接：回到单机模式，清除远程快照（本地数据保留）
export async function disconnect() {
  await saveRemoteConfig({ serverAddress: '', shareEnabled: false })
  await db.delete('remote_snapshot', 'snapshot')
}

// 构建增量推送负载：商品/笔记全量（幂等），流水只推水位之后的
async function buildPushPayload(cfg) {
  const [products, allComments, viewBundle, appearBundle] = await Promise.all([
    db.all('products'),
    db.all('comments'),
    getAllWithKeys('view_records'),
    getAllWithKeys('appear_records'),
  ])

  const comments = allComments.map(c => ({
    id: c.id,
    kind: c.kind,
    target: c.target,
    nickname: cfg.nickname,
    text: c.text,
    created_at: new Date(c.created_at).getTime(),
    updated_at: c.updated_at ? new Date(c.updated_at).getTime() : null,
  }))

  const view_records = []
  let view_last_key = cfg.syncState.view_last_key || 0
  viewBundle.rows.forEach((row, i) => {
    const key = viewBundle.keys[i]
    if (key > view_last_key) {
      view_records.push({ offer_id: row.offer_id, client_row_id: key, viewed_at: row.viewed_at })
      view_last_key = key
    }
  })

  const appear_records = []
  let appear_last_key = cfg.syncState.appear_last_key || 0
  appearBundle.rows.forEach((row, i) => {
    const key = appearBundle.keys[i]
    if (key > appear_last_key) {
      appear_records.push({ offer_id: row.offer_id, client_row_id: key, appeared_at: row.appeared_at })
      appear_last_key = key
    }
  })

  return {
    payload: { products, comments, view_records, appear_records },
    view_last_key, appear_last_key,
  }
}

// 同步一次：共享打开 → 增量推送；无论是否共享都拉取他人数据
export async function syncOnce() {
  const cfg = await getRemoteConfig()
  if (!cfg.serverAddress) return { skipped: true, reason: '未配置服务器' }
  if (!cfg.token) return { skipped: true, reason: '未注册' }

  let pushed = null
  let nextState = cfg.syncState
  if (cfg.shareEnabled) {
    const built = await buildPushPayload(cfg)
    const res = await http(cfg, '/api/v1/sync/push', 'POST', built.payload)
    pushed = res.data
    nextState = {
      ...nextState,
      view_last_key: built.view_last_key,
      appear_last_key: built.appear_last_key,
      last_push_at: Date.now(),
    }
  }

  const pullRes = await http(cfg, '/api/v1/sync/pull?days=50', 'GET')
  await db.put('remote_snapshot', pullRes.data, 'snapshot')
  nextState = { ...nextState, last_pull_at: Date.now() }
  await saveRemoteConfig({ syncState: nextState })

  return { pushed, pulled_at: nextState.last_pull_at }
}
