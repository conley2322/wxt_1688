<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, ArrowRight, TopRight } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import OthersComments from '@/entrypoints/win/components/OthersComments.vue'
import HsTrendChart from '@/components/HsTrendChart.vue'
import HsHourlyChart from '@/components/HsHourlyChart.vue'
import HsHeatmap from '@/components/HsHeatmap.vue'

const groups = ref([])
const stats = ref({ total_suppliers: 0, suppliers_with_notes: 0, total_products: 0, products_with_notes: 0, total_views: 0, total_appears: 0 })
const loading = ref(false)
const searchText = ref('')

// ── 聊天记录（与货源合并展示）──
const chatSuppliers = ref([])
const chatMessages = ref([])
const chatLoading = ref(false)
const rightTab = ref('note')   // note | goods | chat（顺序可拖拽，见 tabOrder）
// 右栏子页签：顺序可拖拽（持久化 imSourceTabsOrder），初始页 = 第一位
const RIGHT_TABS = [
  { key: 'note', label: '备注' },
  { key: 'goods', label: '看过哪些商品' },
  { key: 'chat', label: '聊天记录' },
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
      const valid = imSourceTabsOrder.filter(k => RIGHT_TABS.some(t => t.key === k))
      for (const t of RIGHT_TABS) if (!valid.includes(t.key)) valid.push(t.key)
      tabOrder.value = valid
    }
  } catch {}
}

// 当前选中的供应商
const currentName = ref('')
const currentGroup = computed(() => groups.value.find(g => g.supplier_name === currentName.value) || null)
// 合并条目：本地库供应商 ∪ 聊天记录供应商（按名称对齐，聊天-only 的也能显示）
// 排序：置顶优先；其余按用户选择的模式（最新活动 / 名称）排列。有笔记不再自动置顶。
const pinnedSuppliers = ref([])
const sortMode = ref('time')   // time = 最新活动在前 | name = 名称排序
const mergedEntries = computed(() => {
  const map = new Map()
  for (const g of groups.value) map.set(g.supplier_name, { name: g.supplier_name, group: g, chat: null })
  for (const c of chatSuppliers.value) {
    const key = c.supplier_name || c.display_name || c.login_id
    if (!key) continue
    if (map.has(key)) map.get(key).chat = c
    else map.set(key, { name: key, group: null, chat: c })
  }
  const list = [...map.values()]
  for (const e of list) {
    e.lastActivity = Math.max(e.group?.last_activity || 0, e.chat?.last_ts || 0)
    e.pinned = pinnedSuppliers.value.includes(e.name)
  }
  return list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sortMode.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    return b.lastActivity - a.lastActivity
  })
})

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
function fmtTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── 批量管理 ──
const batchMode = ref(false)
const selectedSet = ref(new Set())

// ── 商品详情（右侧滑出）──
const drawerVisible = ref(false)
const currentProduct = ref(null)
const detail = ref(null)
const detailLoading = ref(false)

onMounted(async () => {
  await loadTabOrder()
  load()
  // 每 60 秒自动刷新（聊天实时入库后排序保持最新）
  setInterval(load, 60000)
})

async function load() {
  loading.value = true
  try {
    const qs = searchText.value.trim() ? `?search=${encodeURIComponent(searchText.value.trim())}` : ''
    const [res, chatRes] = await Promise.all([
      api(`/api/v1/products/grouped${qs}`, 'GET'),
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
      currentName.value = names[0] || ''
    }
  } catch (e) {
    console.error('[MySources] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

let searchTimer = null
watch(searchText, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})

function selectSupplier(name) {
  currentName.value = name
  const entry = mergedEntries.value.find(e => e.name === name)
  // 默认页签跟随拖拽后的第一位
  rightTab.value = tabOrder.value[0] || 'note'
  loadMessages(name)
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
  if (batchMode.value) return
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

// ── 批量选择 ──
function isSelected(id) { return selectedSet.value.has(id) }
function toggleSelect(id) {
  const next = new Set(selectedSet.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedSet.value = next
}
function enterBatch() { batchMode.value = true }
function exitBatch() {
  batchMode.value = false
  selectedSet.value = new Set()
}
const selectedCount = computed(() => selectedSet.value.size)

async function batchDelete() {
  const ids = [...selectedSet.value]
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${ids.length} 个商品？关联的浏览记录、出现记录和笔记将全部删除，不可恢复。`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '全部删除', cancelButtonText: '取消' }
    )
  } catch { return }
  await api('/api/v1/products/batch-delete', 'POST', { offer_ids: ids })
  ElMessage.success('删除完成')
  exitBatch()
  load()
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

async function deleteSupplier(g) {
  try {
    await ElMessageBox.confirm(
      `确认删除供应商「${g.supplier_name}」？名下 ${g.product_count} 个商品及全部浏览记录、笔记将一并删除。`,
      '删除供应商',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch { return }
  await api(`/api/v1/suppliers/${encodeURIComponent(g.supplier_name)}`, 'DELETE')
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
        <el-input v-model="searchText" placeholder="搜索供应商" clearable size="small" :prefix-icon="Search" />
        <div class="sort-toggle">
          <span class="sort-label">排序：</span>
          <span class="sort-opt" :class="{ on: sortMode === 'time' }" @click="setSortMode('time')">最新</span>
          <span class="sort-opt" :class="{ on: sortMode === 'name' }" @click="setSortMode('name')">名称</span>
        </div>
      </div>
      <div class="supplier-list">
        <div
          v-for="e in mergedEntries"
          :key="e.name"
          class="supplier-item"
          :class="{ on: e.name === currentName }"
          @click="selectSupplier(e.name)"
        >
          <span v-if="e.pinned" class="s-pin">📌</span>
          <div class="s-info">
            <div class="s-name">{{ e.name }}</div>
            <div class="s-meta">
              <template v-if="e.group">{{ e.group.product_count }} 件商品<template v-if="e.group.comment_count > 0"> · {{ e.group.comment_count }} 条笔记</template></template>
              <template v-if="e.chat">{{ e.group ? ' · ' : '' }}聊天 {{ e.chat.count }} 条<template v-if="e.chat.bytes"> · {{ fmtChatBytes(e.chat.bytes) }}</template></template>
            </div>
          </div>
          <span
            class="s-pin-btn"
            :class="{ on: e.pinned }"
            :title="e.pinned ? '取消置顶' : '置顶'"
            @click.stop="togglePin(e.name)"
          >📌</span>
        </div>
        <div v-if="mergedEntries.length === 0" class="pane-empty">暂无供应商</div>
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
          <div class="head-actions" v-if="currentGroup">
            <el-button v-if="!batchMode" size="small" @click="enterBatch">批量管理</el-button>
            <el-button v-else size="small" @click="exitBatch">退出批量</el-button>
            <el-button size="small" type="danger" plain :icon="Delete" @click="deleteSupplier(currentGroup)">删除供应商</el-button>
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

        <!-- 商品列表（一行一个）—— v-if：聊天-only 供应商没有 currentGroup，v-show 仍会求值 v-for 导致崩溃 -->
        <div v-if="rightTab === 'goods' && currentGroup" class="product-rows">
          <!-- 供应商数据概览（总商品/浏览/出现 + 趋势图 + 浏览时间轴） -->
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
          <div
            v-for="p in currentGroup.products"
            :key="p.offer_id"
            class="product-row"
            @click="openProduct(p)"
          >
            <el-checkbox
              v-if="batchMode"
              :model-value="isSelected(p.offer_id)"
              class="row-check"
              @change="toggleSelect(p.offer_id)"
              @click.stop
            />
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
              v-if="!batchMode"
              :href="productUrl(p.offer_id)"
              target="_blank"
              class="row-jump"
              title="跳转到 1688 商品详情页"
              @click.stop
            >
              跳转商品<el-icon><TopRight /></el-icon>
            </a>
            <el-icon v-if="!batchMode" class="row-arrow"><ArrowRight /></el-icon>
          </div>
        </div>

        <!-- 聊天记录页 -->
        <div v-if="rightTab === 'chat'" class="chat-panel" v-loading="chatLoading">
          <div v-if="!chatMessages.length" class="pane-empty">暂无聊天记录（客服页会话收发消息后自动保存）</div>
          <div v-for="m in chatMessages" :key="m.id" class="c-msg" :class="{ self: m.sender === 'me' }">
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

    <!-- 批量浮条 -->
    <div v-if="batchMode" class="batch-bar">
      <span>已选 {{ selectedCount }} 个商品</span>
      <el-button type="danger" size="small" :disabled="selectedCount === 0" @click="batchDelete">删除选中</el-button>
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
.head-actions { margin-left: auto; display: flex; gap: 8px; }

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
.row-check { flex-shrink: 0; }
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

/* 批量浮条 */
.batch-bar {
  position: fixed;
  bottom: 24px;
  left: calc(50% + 100px);
  transform: translateX(-50%);
  background: #303133;
  color: #fff;
  border-radius: 24px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);
  z-index: 2000;
}
</style>
