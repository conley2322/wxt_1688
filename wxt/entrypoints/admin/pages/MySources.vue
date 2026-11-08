<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, ArrowRight, TopRight } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'
import { getAiConfig, isAiConfigured, chatComplete } from '@/utils/aiClient.js'
import { buildSupplierChatSystem } from '@/utils/aiPrompts.js'
import {
  loadAllChats, saveAllChats, addChatMessage, removeChatMessage,
  clearChatMessages, subscribeChats, newMsgId,
} from '@/utils/supplierAiStore.js'
import { classifyChat } from '@/utils/chatFilter.js'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import OthersComments from '@/entrypoints/win/components/OthersComments.vue'
import HsTrendChart from '@/components/HsTrendChart.vue'
import HsHourlyChart from '@/components/HsHourlyChart.vue'
import HsHeatmap from '@/components/HsHeatmap.vue'
import {
  groupFactoryInfo, areaBucket, employeeBucket,
  AREA_BUCKETS, EMP_BUCKETS, fmtProfileTime, matchSearch,
} from '@/utils/factoryInfo.js'

const groups = ref([])
const stats = ref({ total_suppliers: 0, suppliers_with_notes: 0, total_products: 0, products_with_notes: 0, total_views: 0, total_appears: 0 })
const loading = ref(false)
const searchText = ref('')
// 概览页「供应商排行」点行跳转：/sources?name=xxx，首次加载时优先选中
const route = useRoute()
const initialName = typeof route.query.name === 'string' ? route.query.name : ''

// ── 工厂信息筛选（级联计数：面板上每个选项的数字都对应列表里真实可见的条目）──
const filterOpen = ref(false)
const activeFilters = ref({})   // { [facetKey]: [value] }

// 全部筛选维度（field = 档案字段；bucket = 数值分档函数；archive = 有无档案）
const ALL_FACETS = [
  { key: 'model', label: '经营模式', field: '经营模式' },
  { key: 'trade', label: '交易方式', field: '交易方式' },
  { key: 'cert', label: '认证信息', field: '认证信息' },
  { key: 'area', label: '厂房面积', bucket: areaBucket, field: '厂房面积' },
  { key: 'emp', label: '员工人数', bucket: employeeBucket, field: '员工人数' },
  { key: 'archive', label: '资料状态' },
]

// 条目的档案视角：货源分组用真实档案；仅聊天记录的条目视为「无档案」，
// 这样它们也参与同一套筛选（只在勾选「无工厂信息」时保留，其余维度下一律被排除）
function entryInfo(e) { return e.group?.archive?.info || null }
function entryHasFactory(e) { return (e.group?.field_count || 0) > 0 }

function entryMatchFacet(e, def, selected) {
  if (!selected.length) return true
  if (def.key === 'archive') return selected.includes(entryHasFactory(e) ? 'has' : 'none')
  const info = entryInfo(e)
  if (def.bucket) return selected.includes(def.bucket(info?.[def.field]))
  return selected.includes(info?.[def.field] || '')
}

// 关键词匹配：货源分组走接口拼好的 search_blob；聊天-only 条目只有名称/登录ID可搜
function entryMatchSearch(e, kw) {
  if (!kw) return true
  if (e.group) return matchSearch(e.group.search_blob, kw)
  return matchSearch(e.chatSearch || '', kw)
}

// 全部条目 = 货源分组 ∪ 聊天记录供应商（同名合并；聊天-only 的附上可搜索文本）
const allEntries = computed(() => {
  const map = new Map()
  for (const g of groups.value) map.set(g.supplier_name, { name: g.supplier_name, group: g, chat: null, chatSearch: '' })
  for (const c of chatSuppliers.value) {
    const key = c.supplier_name || c.display_name || c.login_id
    if (!key) continue
    if (map.has(key)) map.get(key).chat = c
    else map.set(key, { name: key, group: null, chat: c, chatSearch: `${key} ${c.display_name || ''} ${c.login_id || ''}` })
  }
  // 只有 AI 对话的供应商也列出来（客服面板聊过的内容，后台要能点进去看）
  for (const name of Object.keys(aiChats.value)) {
    if (!map.has(name)) map.set(name, { name, group: null, chat: null, chatSearch: name })
  }
  const list = [...map.values()]
  for (const e of list) {
    const aiTs = (aiChats.value[e.name] || []).reduce((t, m) => Math.max(t, m.at || 0), 0)
    e.lastActivity = Math.max(e.group?.last_activity || 0, e.chat?.last_ts || 0, aiTs)
    e.pinned = pinnedSuppliers.value.includes(e.name)
  }
  return list
})

const searchKw = computed(() => searchText.value.trim())
// 第一步：搜索过滤（facet 计数与最终列表都以这一步为基数）
const searchedEntries = computed(() => allEntries.value.filter(e => entryMatchSearch(e, searchKw.value)))

// 级联计数：某维度的选项统计基于「通过搜索 + 其他维度已选条件」的条目，
// 计数 ≥1 的选项才会出现 —— 保证选中某选项后，列表数量和面板数字一致，不会多出无关条目
const facetDefs = computed(() => {
  const defs = []
  for (const def of ALL_FACETS) {
    const base = searchedEntries.value.filter(e => {
      for (const other of ALL_FACETS) {
        if (other.key === def.key) continue
        const sel = activeFilters.value[other.key] || []
        if (sel.length && !entryMatchFacet(e, other, sel)) return false
      }
      return true
    })
    let options = []
    if (def.key === 'archive') {
      const has = base.filter(entryHasFactory).length
      const none = base.length - has
      if (has) options.push({ value: 'has', label: '有工厂信息', count: has })
      if (none) options.push({ value: 'none', label: '无工厂信息', count: none })
    } else if (def.bucket) {
      const counter = new Map()
      for (const e of base) {
        const b = def.bucket(entryInfo(e)?.[def.field])
        if (b) counter.set(b, (counter.get(b) || 0) + 1)
      }
      const buckets = def.key === 'area' ? AREA_BUCKETS : EMP_BUCKETS
      options = buckets.filter(b => counter.has(b.value))
        .map(b => ({ value: b.value, label: b.label, count: counter.get(b.value) }))
    } else {
      const counter = new Map()
      for (const e of base) {
        const v = entryInfo(e)?.[def.field]
        if (v) counter.set(v, (counter.get(v) || 0) + 1)
      }
      options = [...counter.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, label: value, count }))
    }
    if (!options.length) continue
    // 单选项且覆盖全部条目（未选中时）＝该维度没有区分度，不显示，避免塞入无意义选项
    const selected = activeFilters.value[def.key] || []
    if (options.length === 1 && options[0].count === base.length && !selected.length) continue
    defs.push({ ...def, options })
  }
  return defs
})

const activeFilterCount = computed(() =>
  Object.values(activeFilters.value).reduce((n, arr) => n + (arr?.length || 0), 0))
function setFacet(key, values) {
  activeFilters.value = { ...activeFilters.value, [key]: values }
}
function clearFacet(key) {
  const next = { ...activeFilters.value }
  delete next[key]
  activeFilters.value = next
}
function clearAllFilters() { activeFilters.value = {} }

// 第二步：维度筛选（与 facetDefs 的计数口径完全一致）
const visibleEntries = computed(() => searchedEntries.value.filter(e => {
  for (const def of ALL_FACETS) {
    const selected = activeFilters.value[def.key] || []
    if (selected.length && !entryMatchFacet(e, def, selected)) return false
  }
  return true
}))

// ── 聊天记录（与货源合并展示）──
const chatSuppliers = ref([])
const chatMessages = ref([])
const chatLoading = ref(false)
// 聊天页「隐藏无用消息」：只影响展示，不改动原始数据
const chatHideNoise = ref(false)
const chatClassified = computed(() => classifyChat(chatMessages.value))
const chatDisplay = computed(() => (chatHideNoise.value ? chatClassified.value.messages : chatMessages.value))
const rightTab = ref('note')   // note | factory | goods | data | chat | ai（顺序可拖拽，见 tabOrder）
// 右栏子页签：顺序可拖拽（持久化 imSourceTabsOrder），初始页 = 第一位
const RIGHT_TABS = [
  { key: 'note', label: '备注' },
  { key: 'factory', label: '工厂信息' },
  { key: 'goods', label: '商品' },
  { key: 'data', label: '数据' },
  { key: 'chat', label: '聊天记录' },
  { key: 'ai', label: 'AI 分析' },
]
const tabOrder = ref(RIGHT_TABS.map(t => t.key))
const tabItems = computed(() => tabOrder.value.map(k => RIGHT_TABS.find(t => t.key === k)))
let dragTab = null
function onTabDragStart(k, e) {
  dragTab = k
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onTabDrop(k) {
  if (!dragTab || dragTab === k) { dragTab = null; return }
  const arr = [...tabOrder.value]
  arr.splice(arr.indexOf(dragTab), 1)
  arr.splice(arr.indexOf(k), 0, dragTab)
  tabOrder.value = arr
  browser.storage.local.set({ imSourceTabsOrder: arr }).catch(() => {})
  dragTab = null
}
async function loadTabOrder() {
  try {
    const { imSourceTabsOrder } = await browser.storage.local.get('imSourceTabsOrder')
    if (Array.isArray(imSourceTabsOrder)) {
      const saved = imSourceTabsOrder.filter(k => RIGHT_TABS.some(t => t.key === k))
      // 新增页签按默认位置插入（不粗暴追加到末尾，老用户顺序也不乱）
      const out = []
      for (const t of RIGHT_TABS) {
        if (saved.includes(t.key)) { out.push(t.key); continue }
        const idx = RIGHT_TABS.findIndex(x => x.key === t.key)
        let insertAt = out.length
        for (let i = idx - 1; i >= 0; i--) {
          const pos = out.indexOf(RIGHT_TABS[i].key)
          if (pos >= 0) { insertAt = pos + 1; break }
        }
        out.splice(insertAt, 0, t.key)
      }
      tabOrder.value = out
    }
  } catch {}
}

// 当前选中的供应商
const currentName = ref('')
const currentGroup = computed(() => groups.value.find(g => g.supplier_name === currentName.value) || null)
const pinnedSuppliers = ref([])
const sortMode = ref('time')   // time = 最新活动在前 | name = 名称排序
// 合并条目的构建在 allEntries（上方，筛选管线入口）；
// mergedEntries = 最终可见条目（搜索 + 筛选都通过），再按置顶/排序模式排列
const mergedEntries = computed(() => visibleEntries.value.slice().sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  if (sortMode.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
  return b.lastActivity - a.lastActivity
}))

async function loadPinned() {
  const { imPinnedSuppliers, imSupplierSortMode } = await browser.storage.local.get(['imPinnedSuppliers', 'imSupplierSortMode'])
  pinnedSuppliers.value = Array.isArray(imPinnedSuppliers) ? imPinnedSuppliers : []
  if (imSupplierSortMode === 'name' || imSupplierSortMode === 'time') sortMode.value = imSupplierSortMode
}
async function togglePin(name) {
  const list = new Set(pinnedSuppliers.value)
  if (list.has(name)) list.delete(name)
  else list.add(name)
  pinnedSuppliers.value = [...list]
  await browser.storage.local.set({ imPinnedSuppliers: pinnedSuppliers.value })
}
function setSortMode(mode) {
  sortMode.value = mode
  browser.storage.local.set({ imSupplierSortMode: mode })
}
const currentEntry = computed(() => mergedEntries.value.find(e => e.name === currentName.value) || null)
const currentChatSupplier = computed(() => currentEntry.value?.chat || null)

// ── 供应商聚合数据（数据概览）──
const supStats = ref(null)
async function loadSupplierStats(name) {
  supStats.value = null
  if (!name) return
  try {
    const res = await api(`/api/v1/suppliers/stats?name=${encodeURIComponent(name)}`)
    if (res.code === 200) supStats.value = res.data
  } catch (e) {
    console.error('[MySources] 供应商数据加载失败', e)
  }
}

// ── 供应商 AI 对话（每个供应商保留一段独立对话，与客服面板共用同一份存储）──
const AI_QUICK_QUESTIONS = [
  '综合介绍一下这家供应商',
  '价格、起订量和账期怎么样',
  '交期、产能和定制能力如何',
  '有哪些风险和资料缺口',
]

const aiReady = ref(false)
const aiModel = ref('')
const aiChats = ref({})
const aiInput = ref('')
const aiSendingName = ref('')
const aiChatListEl = ref(null)
let aiChatCtrl = null
let stopAiSync = null

const aiMessages = computed(() => aiChats.value[currentName.value] || [])
const aiBusy = computed(() => aiSendingName.value === currentName.value)
const aiAnyBusy = computed(() => !!aiSendingName.value)

function scrollAiToBottom() {
  nextTick(() => {
    const el = aiChatListEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// 旧版单次分析结果 → 对话消息（迁移后旧数据会被移除，避免重复出现）
function legacyReportText(report) {
  const o = report?.result
  if (!o) return ''
  const lines = []
  if (o.summary) lines.push(o.summary)
  for (const s of o.sections || []) {
    lines.push('', `【${s.title}】`)
    for (const it of s.items || []) lines.push(`· ${it}`)
  }
  if (o.risks?.length) {
    lines.push('', '【风险与待核实】')
    for (const r of o.risks) lines.push(`· ${r}`)
  }
  if (o.next_actions?.length) {
    lines.push('', '【下一步】')
    for (const r of o.next_actions) lines.push(`· ${r}`)
  }
  return lines.join('\n').trim()
}

async function loadAiState() {
  const cfg = await getAiConfig()
  aiReady.value = isAiConfigured(cfg)
  aiModel.value = cfg.model || ''
  aiChats.value = await loadAllChats()

  const { aiSupplierReports } = await browser.storage.local.get('aiSupplierReports')
  let migrated = 0
  for (const [name, report] of Object.entries(aiSupplierReports || {})) {
    if ((aiChats.value[name] || []).length) continue
    const text = legacyReportText(report)
    if (!text) continue
    aiChats.value[name] = [{
      id: `legacy-${report.at || Date.now()}`,
      role: 'assistant',
      text,
      at: report.at || Date.now(),
      model: report.model || '',
    }]
    migrated++
  }
  if (migrated) {
    await persistAiChats()
    await browser.storage.local.remove('aiSupplierReports')
  }
}

async function persistAiChats() {
  aiChats.value = await saveAllChats(aiChats.value)
}

// 本页写入 + 跨页面同步（客服面板的 AI 页签共用同一份对话）
function appendAi(name, msg) {
  aiChats.value = { ...aiChats.value, [name]: [...(aiChats.value[name] || []), msg] }
  scrollAiToBottom()
  return addChatMessage(name, msg)
}

function applyExternalChats(next) {
  // 正在生成时，避免外部写入把本页刚追加的消息覆盖掉
  if (aiSendingName.value && aiChats.value[aiSendingName.value]) {
    aiChats.value = { ...next, [aiSendingName.value]: aiChats.value[aiSendingName.value] }
  } else {
    aiChats.value = next
  }
  if (rightTab.value === 'ai') scrollAiToBottom()
}

function stopAi() {
  aiChatCtrl?.abort()
}

async function sendAiMessage(preset, opts = {}) {
  const name = currentName.value
  if (!name || aiAnyBusy.value) return
  const text = String(preset ?? aiInput.value).trim()
  if (!text) return
  if (!aiReady.value) {
    ElMessage.warning('请先在「系统设置」配置 AI 接口')
    return
  }

  if (!opts.reuseUser) {
    aiInput.value = ''
    await appendAi(name, { id: newMsgId(), role: 'user', text, at: Date.now() })
  } else {
    scrollAiToBottom()
  }

  aiSendingName.value = name
  aiChatCtrl = new AbortController()
  try {
    const res = await api(`/api/v1/ai/context/supplier?name=${encodeURIComponent(name)}`)
    if (res.code !== 200) throw new Error(res.message || '读取供应商数据失败')
    const system = buildSupplierChatSystem(res.data)
    // 每次从最新状态取历史，避免等待期间外部写入导致引用过期
    const history = (aiChats.value[name] || [])
      .filter(m => !m.error && m.text)
      .slice(-12)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 2000) }))
    const reply = await chatComplete({
      messages: [{ role: 'system', content: system }, ...history],
      maxTokens: 2400,
      signal: aiChatCtrl.signal,
    })
    await appendAi(name, {
      id: newMsgId(),
      role: 'assistant',
      text: reply,
      at: Date.now(),
      model: aiModel.value,
      chat_kept: res.data.totals?.chat_kept || 0,
      chat_filtered: res.data.totals?.chat_filtered || 0,
    })
  } catch (e) {
    if (e.message !== '已取消') {
      await appendAi(name, {
        id: newMsgId(),
        role: 'assistant',
        text: `请求失败：${e.message}`,
        error: true,
        retryText: text,
        at: Date.now(),
      })
    }
  } finally {
    if (aiSendingName.value === name) aiSendingName.value = ''
    aiChatCtrl = null
    scrollAiToBottom()
  }
}

async function retryAi(m) {
  const name = currentName.value
  aiChats.value = {
    ...aiChats.value,
    [name]: (aiChats.value[name] || []).filter(x => x.id !== m.id),
  }
  if (m.id) await removeChatMessage(name, m.id)
  if (m.retryText) await sendAiMessage(m.retryText, { reuseUser: true })
}

async function clearAiChat() {
  const name = currentName.value
  if (!name || aiAnyBusy.value) return
  try {
    await ElMessageBox.confirm('清空后这段对话将从本机删除，是否继续？', '清空对话', {
      type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消',
    })
  } catch {
    return
  }
  aiChats.value = { ...aiChats.value, [name]: [] }
  await clearChatMessages(name)
  ElMessage.success('已清空对话')
}

async function copyAiMessage(m) {
  try {
    await navigator.clipboard.writeText(m.text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败')
  }
}

function onAiEnter(e) {
  if (e.shiftKey || e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  sendAiMessage()
}

watch(currentName, () => {
  aiInput.value = ''
  if (rightTab.value === 'ai') scrollAiToBottom()
})
watch(rightTab, (tab) => {
  if (tab === 'ai') scrollAiToBottom()
})

function goAiSettings() {
  location.hash = '#/settings'
}

function fmtAiTime(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
// ── 供应商工厂信息（旺旺「档案」落库内容）──
const supProfile = ref(null)
async function loadSupplierProfile(name) {
  supProfile.value = null
  if (!name) return
  try {
    const res = await api(`/api/v1/suppliers/profile?name=${encodeURIComponent(name)}`)
    if (res.code === 200) supProfile.value = res.data || null
  } catch (e) {
    console.error('[MySources] 供应商档案加载失败', e)
  }
}
// 档案来源：优先本地已存档案接口，退回分组接口随带的 archive
const factoryMeta = computed(() => supProfile.value || currentGroup.value?.archive || null)
const factoryInfo = computed(() => factoryMeta.value?.archive_info || factoryMeta.value?.info || null)
const factoryRows = computed(() => groupFactoryInfo(factoryInfo.value))

function fmtTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── 商品详情（右侧滑出）──
const drawerVisible = ref(false)
const currentProduct = ref(null)
const detail = ref(null)
const detailLoading = ref(false)

onMounted(async () => {
  await loadTabOrder()
  await loadAiState()
  stopAiSync = subscribeChats(applyExternalChats)
  load()
  // 每 60 秒自动刷新（聊天实时入库后排序保持最新）
  setInterval(load, 60000)
  // 任意点击 / 右键空白 / 滚动都关闭右键菜单
  document.addEventListener('click', closeCtx)
  document.addEventListener('contextmenu', closeCtx)
  document.addEventListener('scroll', closeCtx, true)
})
onBeforeUnmount(() => {
  stopAiSync?.()
  stopAiSync = null
  document.removeEventListener('click', closeCtx)
  document.removeEventListener('contextmenu', closeCtx)
  document.removeEventListener('scroll', closeCtx, true)
})

async function load() {
  loading.value = true
  try {
    // 搜索与筛选全在本地完成（数据一次取全，选项由数据自动生成，输入即时生效）
    const [res, chatRes] = await Promise.all([
      api('/api/v1/products/grouped', 'GET'),
      api('/api/v1/chat/conversations', 'GET'),
    ])
    if (res.code === 200) {
      groups.value = res.data
      if (res.stats) stats.value = res.stats
    }
    if (chatRes.code === 200) chatSuppliers.value = chatRes.suppliers || []
    await loadPinned()
    // 默认选中第一个供应商（grouped 接口已把有笔记的排最前；聊天-only 的也纳入）
    const names = mergedEntries.value.map(e => e.name)
    if (!currentName.value || !names.includes(currentName.value)) {
      currentName.value = (initialName && names.includes(initialName)) ? initialName : names[0] || ''
      // 初始页签跟随拖拽后的第一位（仅在选择变化时设置，不干扰自动刷新中的当前页签）
      rightTab.value = tabOrder.value[0] || 'note'
      loadMessages(currentName.value)
      loadSupplierProfile(currentName.value)
      loadSupplierStats(currentName.value)
    }
  } catch (e) {
    console.error('[MySources] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

// 搜索/筛选把当前供应商过滤掉了 → 自动切到过滤结果里的第一个（不重置右栏页签）
watch(mergedEntries, (list) => {
  if (!list.length) return
  if (list.some(e => e.name === currentName.value)) return
  const first = list[0]
  currentName.value = first.name
  loadMessages(first.name)
  loadSupplierProfile(first.name)
  loadSupplierStats(first.group ? first.name : '')
})

function selectSupplier(name) {
  currentName.value = name
  const entry = mergedEntries.value.find(e => e.name === name)
  // 默认页签跟随拖拽后的第一位
  rightTab.value = tabOrder.value[0] || 'note'
  loadMessages(name)
  loadSupplierProfile(name)
  loadSupplierStats(entry?.group ? name : '')
}

// ── 聊天记录加载 ──
async function loadMessages(name) {
  chatMessages.value = []
  chatLoading.value = true
  try {
    let list = []
    const res = await api(`/api/v1/chat/messages?supplier_name=${encodeURIComponent(name)}&limit=500`)
    if (res.code === 200) list = res.data || []
    // 未识别供应商（记录里 supplier_name 为显示名兜底）按显示名/登录 ID 再捞一遍
    if (!list.length) {
      const all = await api('/api/v1/chat/messages?limit=800')
      if (all.code === 200) list = (all.data || []).filter(m => (m.display_name || m.login_id) === name)
    }
    chatMessages.value = list
  } catch (e) {
    console.error('[MySources] 聊天记录加载失败:', e)
  } finally {
    chatLoading.value = false
  }
}

function openChatLink(l) {
  window.open(l.href || (l.offer_id ? `https://detail.1688.com/offer/${l.offer_id}.html` : ''), '_blank')
}

function fmtChatBytes(n) {
  if (!n) return '0 B'
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

// 商品详情页链接：有 offer_id 即可拼出，不依赖页面采集
function productUrl(offerId) {
  return `https://detail.1688.com/offer/${offerId}.html`
}

function pad(n) { return String(n).padStart(2, '0') }
function fmtDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── 商品详情 ──
async function openProduct(p) {
  currentProduct.value = p
  drawerVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    const res = await api(`/api/v1/products/${p.offer_id}/stats`, 'GET')
    if (res.code === 200) detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

// 近 30 天有出现/浏览的天（降序）
const viewedDays = computed(() => {
  if (!detail.value?.daily) return []
  return detail.value.daily.filter(x => x.view > 0 || x.appear > 0).reverse()
})

// ── 供应商右键菜单（置顶 / 删除）──
const ctxMenu = ref(null) // { x, y, name }
function openCtx(e, name) {
  const w = 148, h = 82
  ctxMenu.value = {
    x: Math.max(8, Math.min(e.clientX, window.innerWidth - w - 8)),
    y: Math.max(8, Math.min(e.clientY, window.innerHeight - h - 8)),
    name,
  }
}
function closeCtx() { ctxMenu.value = null }
function ctxPinned(name) { return pinnedSuppliers.value.includes(name) }
async function ctxTogglePin() {
  const name = ctxMenu.value?.name
  closeCtx()
  if (name) await togglePin(name)
}
async function ctxDelete() {
  const name = ctxMenu.value?.name
  closeCtx()
  if (name) await deleteSupplier(name)
}

// ── 单个删除 ──
async function deleteProduct(p) {
  try {
    await ElMessageBox.confirm('确认删除该商品？其浏览记录和笔记将一并删除。', '删除商品', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
  } catch { return }
  await api(`/api/v1/products/${p.offer_id}`, 'DELETE')
  ElMessage.success('商品已删除')
  load()
}

async function deleteSupplier(name) {
  const entry = mergedEntries.value.find(e => e.name === name)
  const g = entry?.group
  const chatCount = entry?.chat?.count || 0
  const parts = []
  if (g) parts.push(`名下 ${g.product_count} 个商品及全部浏览记录、笔记`)
  if (chatCount) parts.push(`${chatCount} 条聊天记录`)
  try {
    await ElMessageBox.confirm(
      `确认删除供应商「${name}」？${parts.length ? '将一并删除' + parts.join('、') + '，' : ''}不可恢复。`,
      '删除供应商',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch { return }
  await api(`/api/v1/suppliers/${encodeURIComponent(name)}`, 'DELETE')
  ElMessage.success('供应商已删除')
  currentName.value = ''
  load()
}
</script>

<template>
  <section class="sources-page" v-loading="loading">
    <!-- 左栏：供应商列表 -->
    <aside class="supplier-pane">
      <div class="pane-search">
        <el-input v-model="searchText" placeholder="搜索供应商 / 工厂信息 / 备注" clearable size="small" :prefix-icon="Search" />
        <div class="sort-toggle">
          <span class="sort-label">排序：</span>
          <span class="sort-opt" :class="{ on: sortMode === 'time' }" @click="setSortMode('time')">最新</span>
          <span class="sort-opt" :class="{ on: sortMode === 'name' }" @click="setSortMode('name')">名称</span>
        </div>
        <!-- 工厂信息筛选：选项由数据自动生成，多选叠加 -->
        <div class="filter-bar">
          <div class="filter-head" @click="filterOpen = !filterOpen">
            <span class="filter-title">
              筛选<span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
            </span>
            <span class="filter-toggle">{{ filterOpen ? '收起 ▴' : '展开 ▾' }}</span>
          </div>
          <div v-show="filterOpen" class="filter-body">
            <div v-for="d in facetDefs" :key="d.key" class="filter-row">
              <div class="filter-label">
                {{ d.label }}
                <span v-if="(activeFilters[d.key] || []).length" class="filter-clear" @click.stop="clearFacet(d.key)">清空</span>
              </div>
              <el-select
                :model-value="activeFilters[d.key] || []"
                multiple
                collapse-tags
                collapse-tags-tooltip
                size="small"
                placeholder="全部"
                style="width: 100%"
                @update:model-value="v => setFacet(d.key, v)"
              >
                <el-option
                  v-for="o in d.options"
                  :key="o.value"
                  :label="`${o.label}（${o.count}）`"
                  :value="o.value"
                />
              </el-select>
            </div>
            <div v-if="!facetDefs.length" class="filter-empty">暂无可筛选的工厂信息</div>
            <el-button v-if="activeFilterCount" size="small" text class="filter-reset" @click="clearAllFilters">清空全部筛选</el-button>
          </div>
        </div>
      </div>
      <div class="supplier-list">
        <div
          v-for="e in mergedEntries"
          :key="e.name"
          class="supplier-item"
          :class="{ on: e.name === currentName }"
          @click="selectSupplier(e.name)"
          @contextmenu.prevent.stop="openCtx($event, e.name)"
        >
          <span v-if="e.pinned" class="s-pin">📌</span>
          <div class="s-info">
            <div class="s-name">{{ e.name }}</div>
            <div class="s-meta">
              <template v-if="e.group">{{ e.group.product_count }} 件商品<template v-if="e.group.comment_count > 0"> · {{ e.group.comment_count }} 条笔记</template></template>
              <template v-if="e.chat">{{ e.group ? ' · ' : '' }}聊天 {{ e.chat.count }} 条<template v-if="e.chat.bytes"> · {{ fmtChatBytes(e.chat.bytes) }}</template></template>
              <template v-if="!e.group && !e.chat">AI 对话</template>
            </div>
          </div>
          <span
            class="s-pin-btn"
            :class="{ on: e.pinned }"
            :title="e.pinned ? '取消置顶' : '置顶'"
            @click.stop="togglePin(e.name)"
          >📌</span>
        </div>
        <div v-if="mergedEntries.length === 0" class="pane-empty">
          {{ (searchText || activeFilterCount) ? '没有匹配的供应商，试试放宽搜索或筛选条件' : '暂无供应商' }}
        </div>
      </div>
    </aside>

    <!-- 右栏：供应商内容（商品 / 聊天记录 子页签） -->
    <main class="product-pane">
      <template v-if="currentEntry">
        <header class="pane-head">
          <div class="head-title">
            {{ currentEntry.name }}
            <span class="head-meta">
              <template v-if="currentGroup">{{ currentGroup.product_count }} 件商品<template v-if="currentChatSupplier"> · </template></template>
              <template v-if="currentChatSupplier">聊天 {{ currentChatSupplier.count }} 条 · {{ fmtChatBytes(currentChatSupplier.bytes) }}</template>
            </span>
          </div>
        </header>

        <!-- 右栏子页签（可拖拽排序，顺序持久化） -->
        <div class="right-tabs">
          <span
            v-for="t in tabItems"
            :key="t.key"
            class="r-tab"
            :class="{ on: rightTab === t.key }"
            draggable="true"
            @dragstart="onTabDragStart(t.key, $event)"
            @dragover.prevent
            @drop="onTabDrop(t.key)"
            @click="rightTab = t.key"
            :title="t.label + '（可拖拽排序）'"
          >
            {{ t.label }}<template v-if="t.key === 'chat' && currentChatSupplier">（{{ currentChatSupplier.count }}）</template>
          </span>
        </div>

        <!-- 备注页：与客服页备注面板 / 详情页浮窗互通的同一份备注 -->
        <div v-if="rightTab === 'note'" class="note-panel">
          <div class="editor-box">
            <CommentInput :key="'admin-note-' + currentEntry.name" kind="supplier" :target="currentEntry.name" placeholder="写点关于这个供应商的备注，编辑后自动保存..." />
          </div>
          <div class="others-box">
            <OthersComments :key="'admin-others-' + currentEntry.name" kind="supplier" :target="currentEntry.name" />
          </div>
        </div>

        <!-- 工厂信息页：旺旺「档案」自动保存的内容，按 基础/工厂实力/服务指标 分组 -->
        <div v-if="rightTab === 'factory'" class="factory-panel">
          <div class="f-head">
            <div class="f-title">
              工厂信息
              <span class="f-sub">（来自旺旺「档案」，自动保存）</span>
            </div>
            <div class="f-meta">
              <span v-if="factoryMeta?.year">年限 {{ factoryMeta.year }}</span>
              <span v-if="factoryMeta?.loginIds && factoryMeta.loginIds.length">登录 ID {{ factoryMeta.loginIds.join(' / ') }}</span>
              <span v-if="factoryMeta?.profile_updated_at">更新于 {{ fmtProfileTime(factoryMeta.profile_updated_at) }}</span>
            </div>
          </div>

          <template v-if="factoryRows.length">
            <div v-for="g in factoryRows" :key="g.key" class="f-group">
              <div class="f-group-title">{{ g.label }}</div>
              <div class="f-grid">
                <div v-for="r in g.rows" :key="r.key" class="f-item">
                  <span class="f-key">{{ r.key }}</span>
                  <span class="f-val" :title="r.value">{{ r.value }}</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="pane-empty">
            暂无工厂信息。在客服页切到该供应商的会话，插件会自动读取旺旺「档案」并保存；
            读取时需点一次原生「档案」Tab，之后这里和客服页「信息」页都会显示。
          </div>
        </div>

        <!-- 数据页：供应商统计卡 + 趋势图 + 时段/热力图 + 浏览时间轴（从「商品」页拆出） -->
        <div v-if="rightTab === 'data'" class="data-panel">
          <div class="sup-stats" v-if="supStats">
            <div class="ss-cards">
              <div class="ss-card"><span class="ss-num">{{ supStats.totals.product_count }}</span><span class="ss-label">商品</span></div>
              <div class="ss-card"><span class="ss-num">{{ supStats.totals.view_count }}</span><span class="ss-label">浏览</span></div>
              <div class="ss-card"><span class="ss-num">{{ supStats.totals.appear_count }}</span><span class="ss-label">出现</span></div>
            </div>
            <div class="ss-times" v-if="supStats.last_view_at">
              首次浏览 {{ fmtTs(supStats.first_view_at) }} · 最近浏览 {{ fmtTs(supStats.last_view_at) }}
            </div>
            <HsTrendChart v-if="supStats.daily && supStats.daily.length" :daily="supStats.daily" :height="150" />
            <div class="ss-tl-title">浏览时段分布</div>
            <HsHourlyChart v-if="supStats.hourly && supStats.hourly.length" :hourly="supStats.hourly" :height="120" />
            <div class="ss-tl-title">浏览热力图（星期 × 小时）</div>
            <HsHeatmap v-if="supStats.heatmap && supStats.heatmap.length" :heatmap="supStats.heatmap" :height="150" />
            <div class="ss-tl-title">浏览时间轴（最近 20 条）</div>
            <div v-if="!supStats.timeline || !supStats.timeline.length" class="pane-empty">暂无浏览记录</div>
            <div v-for="t in (supStats.timeline || []).slice(0, 20)" :key="t.ts + t.offer_id" class="ss-tl-row" @click="openProduct({ offer_id: t.offer_id, title: t.title })">
              <span class="ss-tl-time">{{ fmtTs(t.ts) }}</span>
              <span class="ss-tl-title" :title="t.title">{{ t.title || t.offer_id }}</span>
            </div>
          </div>
          <div v-else class="pane-empty">该供应商暂无商品浏览数据（仅聊天记录的供应商没有统计数据）</div>
        </div>

        <!-- 商品列表（一行一个）—— v-if：聊天-only 供应商没有 currentGroup，v-show 仍会求值 v-for 导致崩溃 -->
        <div v-if="rightTab === 'goods' && currentGroup" class="product-rows">
          <div
            v-for="p in currentGroup.products"
            :key="p.offer_id"
            class="product-row"
            @click="openProduct(p)"
          >
            <el-image
              v-if="p.main_img_url"
              :src="p.main_img_url"
              class="row-img"
              fit="cover"
              lazy
            >
              <template #error><div class="row-img-empty">无图</div></template>
            </el-image>
            <div v-else class="row-img-empty">无图</div>

            <div class="row-main">
              <div class="row-title">
                {{ p.title || '未采集标题' }}
                <span v-if="p.comment_count > 0" class="row-note-flag" title="有笔记">📌</span>
              </div>
              <div class="row-comment" v-if="p.my_comment" v-html="p.my_comment"></div>
            </div>

            <div class="row-data">
              <span class="d-appear" title="出现次数">出现 {{ p.appear_count }}</span>
              <span class="d-view" title="浏览次数">浏览 {{ p.view_count }}</span>
            </div>
            <a
              :href="productUrl(p.offer_id)"
              target="_blank"
              class="row-jump"
              title="跳转到 1688 商品详情页"
              @click.stop
            >
              跳转商品<el-icon><TopRight /></el-icon>
            </a>
            <el-icon class="row-arrow"><ArrowRight /></el-icon>
          </div>
        </div>

        <!-- 聊天记录页 -->
        <div v-if="rightTab === 'chat'" class="chat-panel" v-loading="chatLoading">
          <div v-if="chatMessages.length" class="chat-filter-bar">
            <span>
              共 {{ chatMessages.length }} 条
              <template v-if="chatClassified.stats.filtered"> · 系统/自动回复/寒暄等无用消息 {{ chatClassified.stats.filtered }} 条</template>
            </span>
            <label class="cf-toggle">
              <el-switch v-model="chatHideNoise" size="small" />
              <span>隐藏无用消息</span>
            </label>
          </div>
          <div v-if="!chatMessages.length" class="pane-empty">暂无聊天记录（客服页会话收发消息后自动保存）</div>
          <div v-else-if="!chatDisplay.length" class="pane-empty">已隐藏全部 {{ chatMessages.length }} 条消息（均为系统提示 / 自动回复 / 寒暄等）</div>
          <div v-for="m in chatDisplay" :key="m.id" class="c-msg" :class="{ self: m.sender === 'me' }">
            <div class="c-meta">
              <span class="c-nick">{{ m.sender === 'me' ? '我' : (m.nick || m.display_name || '对方') }}</span>
              <span class="c-time">{{ m.time }}</span>
            </div>
            <div v-if="m.text" class="c-text">{{ m.text }}</div>
            <div v-if="m.links && m.links.length" class="c-links">
              <span v-for="(l, i) in m.links" :key="i" class="c-link" :title="l.href" @click="openChatLink(l)">
                🔗 {{ l.text ? (l.text.length > 30 ? l.text.slice(0, 30) + '…' : l.text) : '打开商品' }} ↗
              </span>
            </div>
            <div v-if="m.images && m.images.length" class="c-imgs">
              <img v-for="(img, i) in m.images" :key="i" class="c-img" :src="img.src || img.url" loading="lazy" />
            </div>
          </div>
        </div>

        <!-- AI 页：对话形式，按供应商保留独立会话（档案 + 商品 + 备注 + 过滤后的聊天为上下文） -->
        <div v-if="rightTab === 'ai'" class="ai-panel">
          <div class="ai-head">
            <div class="ai-head-info">
              <span class="ai-head-title">AI 采购助手</span>
              <span class="ai-head-sub">
                <template v-if="currentChatSupplier">聊天 {{ currentChatSupplier.count }} 条</template>
                <template v-if="currentGroup"> · 商品 {{ currentGroup.product_count }} 件</template>
                · 已过滤系统/自动回复/寒暄/重复
              </span>
            </div>
            <div class="ai-head-actions">
              <el-tag v-if="aiModel" size="small" type="info" effect="plain">{{ aiModel }}</el-tag>
              <el-button v-if="aiBusy" size="small" @click="stopAi">停止</el-button>
              <el-button size="small" :disabled="!aiMessages.length || aiAnyBusy" @click="clearAiChat">清空对话</el-button>
            </div>
          </div>

          <div ref="aiChatListEl" class="ai-chat-list">
            <div v-if="!aiReady" class="pane-empty">
              尚未配置 AI 接口，<el-button link type="primary" @click="goAiSettings">去系统设置</el-button> 填写接口地址与 API Key 后即可对话。
            </div>

            <div v-else-if="!aiMessages.length" class="ai-chat-welcome">
              <div class="acw-title">和 AI 聊聊这家供应商</div>
              <div class="acw-sub">已读取档案、商品浏览、我的备注和过滤后的聊天记录；AI 只依据这些资料回答，缺什么会直接说「资料未提及」。</div>
              <div class="acw-chips">
                <span v-for="q in AI_QUICK_QUESTIONS" :key="q" class="acw-chip" @click="sendAiMessage(q)">{{ q }}</span>
              </div>
            </div>

            <div v-for="m in aiMessages" :key="m.id" class="chat-msg" :class="m.role">
              <div class="cm-avatar">{{ m.role === 'user' ? '我' : 'AI' }}</div>
              <div class="cm-main">
                <div class="cm-bubble" :class="{ err: m.error }">{{ m.text }}</div>
                <div class="cm-meta">
                  <span>{{ fmtAiTime(m.at) }}</span>
                  <span v-if="m.model"> · {{ m.model }}</span>
                  <el-button v-if="m.error" link size="small" @click="retryAi(m)">重试</el-button>
                  <el-button link size="small" @click="copyAiMessage(m)">复制</el-button>
                </div>
              </div>
            </div>

            <div v-if="aiBusy" class="chat-msg assistant">
              <div class="cm-avatar">AI</div>
              <div class="cm-main">
                <div class="cm-bubble typing"><span></span><span></span><span></span></div>
              </div>
            </div>
          </div>

          <div v-if="aiReady" class="ai-chat-input">
            <div class="acq-row">
              <span v-for="q in AI_QUICK_QUESTIONS" :key="q" class="acq" @click="aiInput = q">{{ q }}</span>
            </div>
            <div class="aci-box">
              <el-input
                v-model="aiInput"
                type="textarea"
                :rows="2"
                resize="none"
                :disabled="aiAnyBusy"
                placeholder="问这家供应商：价格、起订量、交期、定制能力、风险…（Enter 发送，Shift+Enter 换行）"
                @keydown.enter="onAiEnter"
              />
              <el-button type="primary" :loading="aiBusy" :disabled="!aiInput.trim() || aiAnyBusy" @click="sendAiMessage()">发送</el-button>
            </div>
          </div>
        </div>
      </template>

      <!-- 未选中供应商 -->
      <div v-else class="no-selection">
        <el-empty v-if="!loading" description="请从左侧选择一个供应商" />
      </div>
    </main>

    <!-- 商品详情：右侧滑出 -->
    <el-drawer v-model="drawerVisible" :title="currentProduct?.title || '商品详情'" size="420px">
      <div v-if="currentProduct" v-loading="detailLoading" class="detail">
        <el-image
          v-if="currentProduct.main_img_url"
          :src="currentProduct.main_img_url"
          class="d-img"
          fit="cover"
        />
        <div class="d-supplier">供应商：{{ detail?.supplier_name || '—' }}</div>

        <!-- 核心数据 -->
        <div class="d-data-grid" v-if="detail">
          <div class="d-data-item">
            <div class="d-data-num">{{ detail.totals.appear_count }}</div>
            <div class="d-data-label">出现次数</div>
          </div>
          <div class="d-data-item">
            <div class="d-data-num">{{ detail.totals.view_count }}</div>
            <div class="d-data-label">浏览次数</div>
          </div>
          <div class="d-data-item">
            <div class="d-data-num">{{ detail.totals.comment_count }}</div>
            <div class="d-data-label">笔记条数</div>
          </div>
        </div>
        <div class="d-time-range" v-if="detail && detail.first_viewed_at">
          首次浏览 {{ fmtDateTime(detail.first_viewed_at) }}<br />最近浏览 {{ fmtDateTime(detail.last_viewed_at) }}
        </div>

        <!-- 近 30 天每日数据 -->
        <template v-if="detail && viewedDays.length">
          <h4 class="d-section">近 30 天出现 / 浏览趋势</h4>
          <HsTrendChart :daily="detail.daily" :height="170" />
          <h4 class="d-section" style="margin-top: 10px">浏览时段分布</h4>
          <HsHourlyChart v-if="detail.hourly && detail.hourly.length" :hourly="detail.hourly" :height="130" />
          <h4 class="d-section" style="margin-top: 10px">近 30 天出现 / 浏览记录</h4>
          <div class="d-day-list">
            <div v-for="d in viewedDays" :key="d.date" class="d-day-row">
              <span class="d-day-date">{{ d.date }}</span>
              <span class="d-day-appear" v-if="d.appear">出现 {{ d.appear }} 次</span>
              <span class="d-day-view" v-if="d.view">浏览 {{ d.view }} 次</span>
            </div>
          </div>
        </template>

        <!-- 每次浏览时间线 -->
        <template v-if="detail && detail.view_times.length">
          <h4 class="d-section">浏览时间线（共 {{ detail.view_times.length }} 次）</h4>
          <div class="d-view-times">
            <span v-for="(t, i) in detail.view_times" :key="i" class="d-view-time">{{ fmtDateTime(t) }}</span>
          </div>
        </template>

        <!-- 商品笔记 -->
        <h4 class="d-section">我的笔记</h4>
        <div v-if="currentProduct.comment_count > 0" class="d-comments">
          <div class="d-comment" v-html="currentProduct.my_comment"></div>
        </div>
        <div v-else class="d-empty">暂无笔记，可在商品详情页编辑</div>

        <el-button
          type="danger"
          plain
          class="d-delete"
          :icon="Delete"
          @click="drawerVisible = false; deleteProduct(currentProduct)"
        >删除该商品及全部数据</el-button>
      </div>
    </el-drawer>

    <!-- 供应商右键菜单 -->
    <div
      v-if="ctxMenu"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @click.stop
      @contextmenu.prevent
    >
      <div class="ctx-item" @click="ctxTogglePin">{{ ctxPinned(ctxMenu.name) ? '📌 取消置顶' : '📌 置顶' }}</div>
      <div class="ctx-item danger" @click="ctxDelete">删除供应商</div>
    </div>
  </section>
</template>

<style scoped>
.sources-page {
  display: flex;
  gap: 14px;
  height: calc(100vh - 48px);
  padding-bottom: 0;
}

/* 左栏 */
.supplier-pane {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-search { padding: 10px; border-bottom: 1px solid #f2f3f5; }
.sort-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.sort-label { font-size: 11px; color: #a8abb2; }
.sort-opt {
  font-size: 11px;
  color: #909399;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}
.sort-opt:hover { color: #c9975c; border-color: #e6c9a0; }
.sort-opt.on {
  color: #c9975c;
  font-weight: 600;
  border-color: #c9975c;
  background: #fdf8f3;
}
.supplier-list { flex: 1; overflow-y: auto; padding: 6px; }
.supplier-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.supplier-item:hover { background: #f7f8fa; }
.supplier-item.on { background: #fdf4ea; }
.s-pin { font-size: 12px; flex-shrink: 0; }
.s-pin-btn {
  flex-shrink: 0;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  padding: 2px 4px;
  border-radius: 4px;
  filter: grayscale(1);
  transition: opacity 0.15s;
}
.supplier-item:hover .s-pin-btn { opacity: 0.7; }
.s-pin-btn:hover { opacity: 1; background: #f0f0f0; }
.s-pin-btn.on { opacity: 1; filter: none; }
.s-info { min-width: 0; }
.s-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.supplier-item.on .s-name { color: #c9975c; }
.s-meta { font-size: 11px; color: #a8abb2; margin-top: 2px; }
.pane-empty { text-align: center; font-size: 12px; color: #bbb; padding: 30px 0; }

/* 工厂信息筛选面板 */
.filter-bar { margin-top: 8px; border-top: 1px dashed #f0e6d8; padding-top: 6px; }
.filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}
.filter-title { font-size: 12px; font-weight: 600; color: #606266; }
.filter-count {
  display: inline-block;
  margin-left: 4px;
  background: #c9975c;
  color: #fff;
  border-radius: 9px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 15px;
}
.filter-toggle { font-size: 11px; color: #a8abb2; }
.filter-body { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
.filter-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #909399;
  margin-bottom: 2px;
}
.filter-clear { color: #c9975c; cursor: pointer; }
.filter-clear:hover { text-decoration: underline; }
.filter-empty { font-size: 11px; color: #bbb; padding: 2px 0; }
.filter-reset { align-self: flex-start; font-size: 11px; padding: 0; height: 20px; }

/* 数据页 */
.data-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px; }

/* AI 对话页 */
.ai-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.ai-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #f2f3f5;
  padding: 10px 16px;
  flex-shrink: 0;
}
.ai-head-title { font-size: 14px; font-weight: 600; color: #303133; }
.ai-head-sub { font-size: 11px; color: #a8abb2; margin-left: 8px; }
.ai-head-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.ai-chat-list { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px 6px; background: #fcfcfd; }
.ai-chat-welcome { text-align: center; padding: 28px 12px 20px; }
.acw-title { font-size: 15px; font-weight: 600; color: #303133; }
.acw-sub { font-size: 12px; color: #909399; margin: 6px auto 0; line-height: 1.7; max-width: 520px; }
.acw-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
.acw-chip {
  font-size: 12px;
  color: #a87b3f;
  background: #faf1e6;
  border: 1px solid #f0e4d4;
  border-radius: 14px;
  padding: 5px 12px;
  cursor: pointer;
}
.acw-chip:hover { background: #f5e6d4; }

.chat-msg { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px; }
.chat-msg.user { flex-direction: row-reverse; }
.cm-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #f3e6d6;
  color: #a87b3f;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.chat-msg.user .cm-avatar { background: #c9975c; color: #fff; }
.cm-main { max-width: 78%; display: flex; flex-direction: column; align-items: flex-start; }
.chat-msg.user .cm-main { align-items: flex-end; }
.cm-bubble {
  background: #fff;
  border: 1px solid #f0e4d4;
  border-radius: 4px 10px 10px 10px;
  padding: 9px 12px;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg.user .cm-bubble {
  background: #c9975c;
  border-color: #c9975c;
  color: #fff;
  border-radius: 10px 4px 10px 10px;
}
.cm-bubble.err { background: #fef0f0; border-color: #fbc4c4; color: #c45656; }
.cm-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #b9b9b9; margin-top: 4px; }
.cm-meta .el-button { margin: 0; font-size: 11px; }
.chat-msg.user .cm-meta { justify-content: flex-end; }

.cm-bubble.typing { display: flex; align-items: center; gap: 4px; padding: 12px; }
.cm-bubble.typing span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #c9975c;
  animation: ai-blink 1.2s infinite ease-in-out;
}
.cm-bubble.typing span:nth-child(2) { animation-delay: .2s; }
.cm-bubble.typing span:nth-child(3) { animation-delay: .4s; }
@keyframes ai-blink {
  0%, 80%, 100% { opacity: .25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
}

.ai-chat-input { flex-shrink: 0; border-top: 1px solid #f2f3f5; padding: 8px 16px 12px; background: #fff; }
.acq-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.acq {
  font-size: 11px;
  color: #909399;
  background: #f7f8fa;
  border-radius: 12px;
  padding: 3px 10px;
  cursor: pointer;
}
.acq:hover { color: #a87b3f; background: #faf1e6; }
.aci-box { display: flex; align-items: flex-end; gap: 8px; }
.aci-box .el-textarea { flex: 1; }
.aci-box :deep(.el-textarea__inner) { font-size: 13px; line-height: 1.6; border-radius: 8px; }
.aci-box .el-button { height: 40px; }

/* 工厂信息页 */
.factory-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px; }
.f-head { border-bottom: 1px solid #f2f3f5; padding-bottom: 8px; margin-bottom: 10px; }
.f-title { font-size: 14px; font-weight: 600; color: #303133; }
.f-sub { font-size: 11px; font-weight: 400; color: #a8abb2; }
.f-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; font-size: 11px; color: #909399; }
.f-group {
  border: 1px solid #f0e6d8;
  border-radius: 8px;
  background: #fffdf9;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.f-group-title { font-size: 12px; font-weight: 600; color: #c9975c; margin-bottom: 8px; }
.f-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
.f-item { display: flex; gap: 8px; font-size: 12px; align-items: baseline; }
.f-key { flex-shrink: 0; width: 64px; color: #a08969; }
.f-val { color: #303133; word-break: break-all; }

/* 右栏 */
.product-pane {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-head {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f3f5;
}
.head-title { font-size: 16px; font-weight: 600; color: #303133; }
.head-meta { font-size: 12px; font-weight: 400; color: #a8abb2; margin-left: 10px; }

/* 供应商笔记 */
.supplier-note {
  margin: 12px 16px 0;
  background: #fdf8f3;
  border-left: 3px solid #c9975c;
  border-radius: 0 6px 6px 0;
  padding: 10px 14px;
}
.note-row { display: flex; align-items: flex-start; gap: 12px; }
.note-text { font-size: 13px; color: #5b4a35; line-height: 1.5; flex: 1; }
.note-text :deep(p) { margin: 0 0 4px; }
.note-text :deep(ul), .note-text :deep(ol) { margin: 4px 0; padding-left: 18px; }
.note-time { font-size: 11px; color: #c4b08c; white-space: nowrap; padding-top: 2px; }

/* 右栏子页签 */
.right-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px 0;
  border-bottom: 1px solid #f2f3f5;
}
.r-tab {
  font-size: 13px;
  color: #909399;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px 6px 0 0;
  border-bottom: 2px solid transparent;
  user-select: none;
}
.r-tab:hover { color: #c9975c; }
.r-tab.on {
  color: #c9975c;
  font-weight: 600;
  border-bottom-color: #c9975c;
}

/* 备注页 */
.note-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 16px; }
.editor-box {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
}
.editor-box :deep(.rich-editor-wrap) { min-height: 150px; }
.others-box { margin-top: 10px; max-height: 220px; overflow-y: auto; }
.others-box :deep(.oc-title) { font-size: 12px; color: #909399; margin: 8px 0 6px; }
.others-box :deep(.oc-item) { border-top: 1px solid #f2f3f5; }
.others-box :deep(.oc-text) { font-size: 13px; color: #5b4a35; line-height: 1.5; }
.others-box :deep(.oc-text p) { margin: 0 0 4px; }
.others-box :deep(.oc-empty) { font-size: 12px; color: #bbb; padding: 6px 0; }

/* 聊天记录页 */
.chat-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 16px; }
.chat-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  color: #a8abb2;
  padding: 0 0 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid #f5f5f5;
}
.cf-toggle { display: flex; align-items: center; gap: 6px; color: #909399; cursor: pointer; }
.c-msg {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
  background: #f7f8fa;
  max-width: 620px;
}
.c-msg.self { background: #fdf4ea; margin-left: auto; }
.c-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.c-nick { font-size: 11px; font-weight: 600; color: #666; }
.c-msg.self .c-nick { color: #c9975c; }
.c-time { font-size: 10px; color: #c4b08c; }
.c-text { font-size: 13px; color: #303133; line-height: 1.6; word-break: break-all; white-space: pre-wrap; }
.c-links { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
.c-link { font-size: 12px; color: #409eff; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-link:hover { text-decoration: underline; }
.c-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.c-img { max-width: 180px; max-height: 140px; border-radius: 6px; border: 1px solid #ebeef5; object-fit: cover; cursor: zoom-in; }

/* 供应商数据概览 */
.sup-stats {
  border: 1px solid #f0e6d8;
  border-radius: 8px;
  background: #fffdf9;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.ss-cards { display: flex; gap: 8px; margin-bottom: 6px; }
.ss-card {
  flex: 1;
  background: #fff;
  border: 1px solid #f0e6d8;
  border-radius: 6px;
  padding: 6px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ss-num { font-size: 16px; font-weight: 700; color: #c9975c; }
.ss-label { font-size: 10px; color: #b9986f; }
.ss-times { font-size: 11px; color: #a8abb2; margin-bottom: 6px; }
.ss-tl-title { font-size: 12px; color: #909399; margin: 8px 0 4px; }
.ss-tl-row {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-top: 1px solid #f7f4ef;
  cursor: pointer;
  font-size: 12px;
}
.ss-tl-row:hover .ss-tl-title { color: #c9975c; }
.ss-tl-time { flex-shrink: 0; color: #c4b08c; }
.ss-tl-title {
  flex: 1;
  min-width: 0;
  color: #5b4a35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 商品行 */
.product-rows { flex: 1; overflow-y: auto; padding: 8px 10px; }
.product-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}
.product-row:hover { background: #faf7f3; border-color: #f0e6d8; }
.row-img {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  flex-shrink: 0;
  background: #fafafa;
}
.row-img-empty {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 11px;
  flex-shrink: 0;
}
.row-main { flex: 1; min-width: 0; }
.row-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-note-flag { margin-left: 4px; }
.row-comment {
  font-size: 12px;
  color: #909399;
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-comment :deep(p) { display: inline; margin: 0; }
.row-comment :deep(img) { display: none; }
.row-data {
  display: flex;
  gap: 14px;
  flex-shrink: 0;
  font-size: 12px;
}
.d-appear { color: #7d96bd; }
.d-view { color: #c9975c; font-weight: 600; }
.row-jump {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  font-size: 12px;
  color: #c9975c;
  text-decoration: none;
  padding: 4px 8px;
  border: 1px solid #ecdcc7;
  border-radius: 4px;
  background: #fffdfb;
}
.row-jump:hover { background: #fdf4ea; border-color: #c9975c; }
.row-arrow { color: #c0c4cc; flex-shrink: 0; }

.no-selection { flex: 1; display: flex; align-items: center; justify-content: center; }

/* 详情抽屉 */
.d-img { width: 100%; max-height: 240px; border-radius: 8px; }
.d-supplier { font-size: 13px; color: #606266; margin: 12px 0; }
.d-data-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}
.d-data-item {
  background: #faf7f3;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.d-data-num { font-size: 22px; font-weight: 700; color: #c9975c; }
.d-data-label { font-size: 12px; color: #909399; margin-top: 2px; }
.d-time-range { font-size: 12px; color: #909399; margin-bottom: 8px; line-height: 1.8; }
.d-section { font-size: 14px; font-weight: 600; color: #303133; margin: 18px 0 10px; }

.d-day-list { display: flex; flex-direction: column; gap: 6px; }
.d-day-row {
  display: flex;
  gap: 12px;
  font-size: 12px;
  padding: 6px 10px;
  background: #fafafa;
  border-radius: 6px;
}
.d-day-date { color: #606266; font-weight: 600; min-width: 48px; }
.d-day-appear { color: #7d96bd; }
.d-day-view { color: #c9975c; }

.d-view-times { display: flex; flex-wrap: wrap; gap: 6px; }
.d-view-time {
  font-size: 11px;
  color: #8a6d4b;
  background: #fdf8f3;
  border: 1px solid #f0e2cf;
  border-radius: 4px;
  padding: 3px 8px;
}

.d-comments { font-size: 13px; color: #606266; line-height: 1.6; }
.d-comment {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px 14px;
}
.d-comment :deep(p) { margin: 0 0 4px; }
.d-comment :deep(ul), .d-comment :deep(ol) { margin: 4px 0; padding-left: 18px; }
.d-empty { font-size: 13px; color: #bbb; }
.d-delete { margin-top: 24px; width: 100%; }

/* 供应商右键菜单 */
.ctx-menu {
  position: fixed;
  z-index: 3000;
  min-width: 140px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, .14);
  padding: 4px;
  font-size: 13px;
}
.ctx-item {
  padding: 8px 12px;
  border-radius: 5px;
  color: #303133;
  cursor: pointer;
  user-select: none;
}
.ctx-item:hover { background: #faf7f3; color: #c9975c; }
.ctx-item.danger { color: #f56c6c; }
.ctx-item.danger:hover { background: #fef0f0; color: #f56c6c; }
</style>
