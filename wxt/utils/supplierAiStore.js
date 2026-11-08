// supplierAiStore.js — 供应商 AI 对话的共享存储
// 后台「我的货源 · AI」与客服面板「AI」页签共用同一个键、同一套消息结构，
// 两边通过 browser.storage.onChanged 实时同步，后台能看到客服里聊过的 AI 问答。

export const AI_CHAT_KEY = 'aiSupplierChats'
export const AI_CHAT_MAX_MSG = 40
export const AI_CHAT_MAX_SUPPLIERS = 60

function lastTs(msgs) {
  let t = 0
  for (const m of msgs) t = Math.max(t, Number(m?.at ?? m?.ts) || 0)
  return t
}

export function newMsgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function loadAllChats() {
  const stored = await browser.storage.local.get(AI_CHAT_KEY)
  const all = stored[AI_CHAT_KEY]
  return all && typeof all === 'object' && !Array.isArray(all) ? all : {}
}

export async function saveAllChats(all) {
  const entries = Object.entries(all || {})
    .map(([name, msgs]) => [name, Array.isArray(msgs) ? msgs.slice(-AI_CHAT_MAX_MSG) : []])
    .filter(([, msgs]) => msgs.length)
    .sort((a, b) => lastTs(b[1]) - lastTs(a[1]))
    .slice(0, AI_CHAT_MAX_SUPPLIERS)
  const out = {}
  for (const [name, msgs] of entries) out[name] = msgs
  await browser.storage.local.set({ [AI_CHAT_KEY]: out })
  return out
}

export async function addChatMessage(name, msg) {
  const chats = await loadAllChats()
  const list = Array.isArray(chats[name]) ? [...chats[name]] : []
  if (!msg?.id || !list.some(m => m.id === msg.id)) list.push(msg)
  chats[name] = list
  return saveAllChats(chats)
}

export async function updateChatMessage(name, id, patch) {
  const chats = await loadAllChats()
  const list = chats[name] || []
  chats[name] = list.map(m => (m.id === id ? { ...m, ...patch } : m))
  return saveAllChats(chats)
}

export async function removeChatMessage(name, id) {
  const chats = await loadAllChats()
  chats[name] = (chats[name] || []).filter(m => m.id !== id)
  return saveAllChats(chats)
}

export async function clearChatMessages(name) {
  const chats = await loadAllChats()
  delete chats[name]
  return saveAllChats(chats)
}

// 订阅其他页面的写入；返回取消订阅函数
export function subscribeChats(cb) {
  if (!browser?.storage?.onChanged) return () => {}
  const handler = (changes, area) => {
    if (area !== 'local' || !changes[AI_CHAT_KEY]) return
    const value = changes[AI_CHAT_KEY].newValue
    cb(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
  }
  browser.storage.onChanged.addListener(handler)
  return () => browser.storage.onChanged.removeListener(handler)
}
