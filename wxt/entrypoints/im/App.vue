<!-- im/App.vue — 旺旺客服页「备注」Tab 面板（左右布局：左侧竖向导航 + 右侧内容页）
     左侧导航：备注 / 聊天 / 商品 / 信息
     - 备注：富文本编辑器（与详情页浮窗互通，自动保存）+ 团队成员笔记
     - 聊天：实时采集入库的聊天记录（含图片，永久保存）
     - 商品：该供应商下我看过的商品
     - 信息：供应商档案基础信息（自动读取原生「档案」Tab：公司名/年限/交易方式/BSR） -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { api } from '@/utils/dataClient.js'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import OthersComments from '@/entrypoints/win/components/OthersComments.vue'
import HsTrendChart from '@/components/HsTrendChart.vue'
import HsHourlyChart from '@/components/HsHourlyChart.vue'
import HsHeatmap from '@/components/HsHeatmap.vue'
import { getImDoc, onImShow, onImDocChange, onChatUpdated, extractHeaderName, extractRenderedArchive, insertIntoChatInput, readNativeArchive, setResolvedSupplier } from './imdom.js'

// ── URL 参数：本面板由外层页面 content script 挂载，location 为外层（同参）；
//    兜底从同源聊天 iframe 的 src 解析 ──
const params = new URLSearchParams(location.search)
const touid = params.get('touid') || new URLSearchParams(getImDoc() ? getImDoc().location.search : '').get('touid') || ''
const siteid = params.get('siteid') || new URLSearchParams(getImDoc() ? getImDoc().location.search : '').get('siteid') || ''
const offerId = ((params.get('offerId') || new URLSearchParams(getImDoc() ? getImDoc().location.search : '').get('offerId') || '')).replace(/\D/g, '')
// 会话登录 ID：touid 去掉 siteid 前缀（cnalichnnihaobin8 - cnalichn → nihaobin8）
const urlLoginId = siteid && touid.startsWith(siteid) ? touid.slice(siteid.length) : touid

const activePage = ref('note')   // 跟随左侧导航
// 左侧导航：顺序可拖拽（持久化 imNavOrder）
const NAV_PAGES = [
  { key: 'note', icon: '📝', label: '备注' },
  { key: 'chat', icon: '💬', label: '聊天' },
  { key: 'goods', icon: '📦', label: '商品' },
  { key: 'info', icon: '🏭', label: '信息' },
]
const navOrder = ref(NAV_PAGES.map(p => p.key))
const navItems = computed(() => navOrder.value.map(k => NAV_PAGES.find(p => p.key === k)))
let dragKey = null
function onNavDragStart(k, e) {
  dragKey = k
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onNavDrop(k) {
  if (!dragKey || dragKey === k) { dragKey = null; return }
  const arr = [...navOrder.value]
  arr.splice(arr.indexOf(dragKey), 1)
  arr.splice(arr.indexOf(k), 0, dragKey)
  navOrder.value = arr
  browser.storage.local.set({ imNavOrder: arr }).catch(() => {})
  dragKey = null
}
async function loadNavOrder() {
  try {
    const { imNavOrder } = await browser.storage.local.get('imNavOrder')
    if (Array.isArray(imNavOrder)) {
      const valid = imNavOrder.filter(k => NAV_PAGES.some(p => p.key === k))
      for (const p of NAV_PAGES) if (!valid.includes(p.key)) valid.push(p.key)
      navOrder.value = valid
    }
  } catch {}
}
const supplierName = ref('')
const resolveSource = ref('')   // binding | detail | offer | archive | header-name | ''
const loginId = ref(urlLoginId) // 当前会话显示名（随会话切换更新）
const products = ref([])
const archiveInfo = ref(null)   // 档案基础信息 { companyName, year, tradeType, bsr }
const loadedOnce = ref(false)

// 主世界桥接的对方登录 ID（box-scan 写在 <html data-alocs-im-loginid>，裸 ID）
function bridgedLoginId() {
  return (document.documentElement.dataset.alocsImLoginId || '').replace(/^(cnalichn|cntaobao|b2b-)/, '')
}

const sourceText = computed(() =>
  ({ binding: '历史绑定', detail: '详情页映射', offer: '本地商品库', archive: '供应商档案', 'header-name': '会话名称' }[resolveSource.value] || '未识别'))

// ── touid/会话名 → 供应商名 绑定映射（browser.storage.local 持久化）──
async function loadBindings() {
  const { imSupplierBindings } = await browser.storage.local.get('imSupplierBindings')
  return imSupplierBindings || {}
}
async function writeBindings(bindings) {
  await browser.storage.local.set({ imSupplierBindings: bindings })
}
async function saveBinding(key, name) {
  if (!key || !name) return
  const b = await loadBindings()
  b[key] = name
  await writeBindings(b)
}

// ── 供应商全自动解析 ──
// 会话身份 = 头部显示名（即时准确；主世界桥的 loginId 有 1.5s 滞后，只做辅助不能用于判定）。
// 档案永远优先：每次会话切换自动读原生「档案」（真实店铺公司名，按会话名缓存），
// 读不到才退回：入口 offerId 商品库（仅入口会话）→ 历史/入口绑定 → 公司名后缀直认。
// 绑定不能抢先：错误时期的陈旧绑定会把会话错绑到别的供应商（实测「广州雅洁厨具→广东百申实业」）。
const COMPANY_SUFFIX = /公司|厂|商贸|经营部|实业|门市|经销|批发部|商行|贸易/
const archiveCache = new Map() // 会话显示名 → 档案信息 | null（读不到也缓存，页面会话内不再重试）
const entryHeaderName = ref(urlLoginId) // 页面加载时的首个会话（入口会话）显示名

// 档案解析成功后的统一落库：覆盖绑定（自愈陈旧错误绑定）+ 档案信息入库 + 聊天记录回填
async function applyArchiveResolution(info, headerName) {
  archiveInfo.value = info
  supplierName.value = info.companyName
  resolveSource.value = 'archive'
  await saveBinding(headerName, info.companyName)
    await api('/api/v1/suppliers/profile', 'POST', {
      login_id: headerName, name: info.companyName, year: info.year, info: info.info, remove_loginid: true,
    }).catch(() => {})
  // 历史聊天记录按真实供应商名回填（此前可能以显示名兜底入库，幂等）
  await api('/api/v1/chat/rekey', 'POST', { login_id: headerName, supplier_name: info.companyName }).catch(() => {})
}

async function resolveSupplier() {
  supplierName.value = ''
  resolveSource.value = ''
  archiveInfo.value = null
  const headerName = loginId.value
  if (!headerName) return
  const isEntryConv = headerName === entryHeaderName.value

  // 0. 会话内已读过档案 → 直接用（不重复点击原生 Tab）
  if (archiveCache.has(headerName)) {
    const cached = archiveCache.get(headerName)
    if (cached?.companyName) {
      archiveInfo.value = cached
      supplierName.value = cached.companyName
      resolveSource.value = 'archive'
      return
    }
  } else {
    // 1. 自动读档案（真实店铺公司名；读到才缓存，失败走兜底）
    try {
      const info = await readNativeArchive()
      if (info?.companyName) {
        archiveCache.set(headerName, info)
        await applyArchiveResolution(info, headerName)
        return
      }
    } catch (e) {
      console.warn('[alocs:im] 档案读取失败', e)
    }
    archiveCache.set(headerName, null)
  }

  // 2. 入口会话：offerId → 本地商品库（详情页/列表页浏览时落库的 产品↔供应商 映射）
  if (isEntryConv && offerId) {
    try {
      const res = await api(`/api/v1/products/${offerId}/stats`)
      if (res.code === 200 && res.data.supplier_name) {
        supplierName.value = res.data.supplier_name
        resolveSource.value = 'offer'
        await saveBinding(headerName, supplierName.value)
        if (urlLoginId) await saveBinding(urlLoginId, supplierName.value)
        await api('/api/v1/suppliers/profile', 'POST', {
          login_id: urlLoginId, name: supplierName.value,
        }).catch(() => {})
        await api('/api/v1/chat/rekey', 'POST', { login_id: headerName, supplier_name: supplierName.value }).catch(() => {})
        return
      }
    } catch (e) {
      console.warn('[alocs:im] offerId 解析供应商失败', e)
    }
  }
  // 3. 历史绑定（档案读不到时兜底）
  const bindings = await loadBindings()
  if (bindings[headerName]) {
    supplierName.value = bindings[headerName]
    resolveSource.value = 'binding'
  } else if (isEntryConv && urlLoginId && bindings[urlLoginId]) {
    supplierName.value = bindings[urlLoginId]
    resolveSource.value = 'binding'
  }
  // 4. 头部显示名本身就是公司名（旺旺昵称常为企业名，但可能与店铺名不同，最低优先级）
  if (!supplierName.value && COMPANY_SUFFIX.test(headerName)) {
    supplierName.value = headerName
    resolveSource.value = 'header-name'
    bindings[headerName] = headerName
    await writeBindings(bindings)
  }
  // 解析成功：把结果共享给采集端（采集实时使用面板解析的权威名字）
  setResolvedSupplier(headerName, supplierName.value)
}

// ── 数据加载 ──
async function loadProducts(name) {
  products.value = []
  if (!name) return
  try {
    const res = await api('/api/v1/products/grouped')
    if (res.code === 200) {
      const g = (res.data || []).find(x => x.supplier_name === name)
      products.value = g?.products || []
    }
  } catch {}
}

// ── 供应商聚合数据（浏览/出现/趋势/时间轴）──
const supStats = ref(null)
async function loadSupplierStats(name) {
  supStats.value = null
  if (!name) return
  try {
    const res = await api(`/api/v1/suppliers/stats?name=${encodeURIComponent(name)}`)
    if (res.code === 200) supStats.value = res.data
  } catch {}
}

function fmtTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── 最近聊天：读实时采集入库的记录（含图片，永久保存）──
const chatMsgs = ref([])
const chatLoading = ref(false)
async function loadChat() {
  const key = loginId.value
  if (!key) { chatMsgs.value = []; return }
  chatLoading.value = true
  try {
    const res = await api(`/api/v1/chat/messages?login_id=${encodeURIComponent(key)}&limit=120`)
    chatMsgs.value = res.code === 200 ? (res.data || []) : []
  } catch {
    chatMsgs.value = []
  }
  chatLoading.value = false
}

async function refreshAll() {
  await resolveSupplier()
  await loadProducts(supplierName.value)
  await loadSupplierStats(supplierName.value)
  await loadChat()
  loadedOnce.value = true
}

// ── 会话切换感知：头部显示名变化时重新解析 ──
let headerObserver = null
let observedDoc = null
function watchConversationHeader() {
  const doc = getImDoc()
  if (!doc) return
  if (headerObserver && observedDoc === doc) return
  if (headerObserver) headerObserver.disconnect()
  observedDoc = doc
  headerObserver = new MutationObserver(() => {
    const text = extractHeaderName()
    if (text && text !== loginId.value) {
      console.log('[alocs:im] 会话切换 →', text)
      loginId.value = text
      refreshAll()
      return
    }
    // 档案面板渲染/更新时校正供应商名（档案是最权威来源，覆盖陈旧绑定）
    const rendered = extractRenderedArchive()
    if (rendered?.companyName && rendered.companyName !== supplierName.value) {
      console.log('[alocs:im] 档案校正供应商 →', rendered.companyName)
      refreshAll()
    }
  })
  headerObserver.observe(doc.body, { childList: true, subtree: true, characterData: true })
}

// ── 快捷话术（点击填入聊天输入框，用户确认后自己点发送）──
const DEFAULT_PHRASES = [
  '你好，这款有货吗？', '最低多少钱？', '支持一件代发吗？', '可以发样品吗？',
  '多久能发货？', '可以定制吗？', '物流走什么快递？', '有量大优惠吗？',
]
const phrases = ref([])
const newPhrase = ref('')
const phraseTip = ref('')
let tipTimer = null

async function loadPhrases() {
  const { imQuickPhrases } = await browser.storage.local.get('imQuickPhrases')
  phrases.value = Array.isArray(imQuickPhrases) && imQuickPhrases.length ? [...imQuickPhrases] : [...DEFAULT_PHRASES]
}
async function savePhrases() {
  await browser.storage.local.set({ imQuickPhrases: phrases.value })
}
function flashTip(text) {
  phraseTip.value = text
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => { phraseTip.value = '' }, 2500)
}
function usePhrase(p) {
  const ok = insertIntoChatInput(p)
  flashTip(ok ? '已填入聊天输入框，请确认后自行发送' : '未找到聊天输入框（请先选中左侧会话）')
}
function addPhrase() {
  const t = newPhrase.value.trim()
  if (!t) return
  phrases.value.push(t.slice(0, 60))
  newPhrase.value = ''
  savePhrases()
}
function removePhrase(i) {
  phrases.value.splice(i, 1)
  savePhrases()
}

function openOffer(id) {
  window.open(`https://detail.1688.com/offer/${id}.html`, '_blank')
}

function openLink(l) {
  window.open(l.href || (l.offer_id ? `https://detail.1688.com/offer/${l.offer_id}.html` : ''), '_blank')
}

function stripHtml(html, len = 40) {
  const t = String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return t.length > len ? t.slice(0, len) + '…' : t
}

onMounted(() => {
  // 头部显示名比 URL touid 更贴近当前会话，挂载时先取一次
  const h = extractHeaderName()
  if (h) { loginId.value = h; entryHeaderName.value = h }
  loadNavOrder()
  refreshAll()
  loadPhrases()
  watchConversationHeader()
  onImShow(refreshAll)
  // iframe 文档被 1688 重建后重新挂头部观察器
  onImDocChange(watchConversationHeader)
  // 实时聊天入库后联动刷新
  onChatUpdated(loadChat)
})
onBeforeUnmount(() => {
  if (headerObserver) headerObserver.disconnect()
  onImShow(null)
  onImDocChange(null)
  onChatUpdated(null)
})

watch(supplierName, (name) => loadProducts(name))
</script>

<template>
  <div class="alocs-panel">
    <!-- 左侧竖向导航（可拖拽排序，顺序持久化） -->
    <div class="side-nav">
      <div
        v-for="p in navItems"
        :key="p.key"
        class="nav-item"
        :class="{ active: activePage === p.key }"
        draggable="true"
        @dragstart="onNavDragStart(p.key, $event)"
        @dragover.prevent
        @drop="onNavDrop(p.key)"
        @click="activePage = p.key"
        :title="p.label + '（可拖拽排序）'"
      >
        <span class="nav-icon">{{ p.icon }}</span><span class="nav-label">{{ p.label }}</span>
      </div>
    </div>

    <!-- 右侧内容页 -->
    <div class="content-area">
      <!-- 顶部供应商条（所有页共用） -->
      <div class="sup-bar">
        <div class="sup-line">
          <span class="sup-name" :title="supplierName || '未识别供应商'">
            {{ supplierName || '未识别供应商' }}
          </span>
          <span v-if="loginId" class="login-id">{{ loginId }}</span>
        </div>
        <div class="sup-sub">
          <span class="src-tag" :class="{ ok: supplierName }">{{ sourceText }}</span>
          <span v-if="!supplierName && loadedOnce" class="bind-hint">自动识别未命中，浏览其商品详情页后自动学会</span>
        </div>
      </div>

      <!-- 备注页 -->
      <div v-show="activePage === 'note'" class="page">
        <div class="sec note-sec">
          <template v-if="supplierName">
            <div class="editor-box">
              <CommentInput :key="'note-' + supplierName" kind="supplier" :target="supplierName" />
            </div>
            <div class="others-box">
              <OthersComments :key="'others-' + supplierName" kind="supplier" :target="supplierName" />
            </div>
          </template>
          <div v-else class="empty-tip">
            {{ loadedOnce ? '未识别供应商（自动识别未命中），浏览该供应商的商品详情页后自动学会' : '加载中…' }}
          </div>
        </div>
      </div>

      <!-- 聊天页 -->
      <div v-show="activePage === 'chat'" class="page">
        <div class="sec">
          <div class="page-row-title">
            快捷话术 <span class="sec-tip">（点击填入聊天输入框，确认后自己点发送）</span>
          </div>
          <div class="phrase-grid">
            <div v-for="(p, i) in phrases" :key="i + p" class="phrase-chip" :title="p" @click="usePhrase(p)">
              <span class="phrase-text">{{ p }}</span>
              <span class="phrase-del" title="删除" @click.stop="removePhrase(i)">×</span>
            </div>
          </div>
          <div class="phrase-add">
            <input v-model="newPhrase" class="phrase-input" placeholder="添加常用话术…" maxlength="60" @keyup.enter="addPhrase" />
            <button class="phrase-add-btn" @click="addPhrase">添加</button>
          </div>
          <div v-if="phraseTip" class="phrase-tip">{{ phraseTip }}</div>
        </div>
        <div class="sec chat-sec">
          <div class="page-row-title">
            聊天记录 <span class="sec-tip">（实时保存，最近 {{ chatMsgs.length }} 条）</span>
            <button class="chat-refresh" title="刷新聊天记录" @click="loadChat">↻</button>
          </div>
          <div v-if="!chatMsgs.length" class="empty-tip">{{ chatLoading ? '加载中…' : '暂无聊天记录（选中会话并收发消息后自动保存）' }}</div>
          <div v-for="m in chatMsgs" :key="m.id" class="chat-row" :class="{ self: m.sender === 'me' }">
            <div class="chat-meta">
              <span class="chat-nick">{{ m.sender === 'me' ? '我' : (m.nick || m.display_name || '对方') }}</span>
              <span class="chat-time">{{ m.time }}</span>
            </div>
            <div v-if="m.text" class="chat-text">{{ m.text }}</div>
            <div v-if="m.links && m.links.length" class="chat-links">
              <span v-for="(l, i) in m.links" :key="i" class="chat-link" :title="l.text || l.href" @click="openLink(l)">
                🔗 {{ l.text ? (l.text.length > 24 ? l.text.slice(0, 24) + '…' : l.text) : '打开商品' }} ↗
              </span>
            </div>
            <div v-if="m.images && m.images.length" class="chat-imgs">
              <img v-for="(img, i) in m.images" :key="i" class="chat-img" :src="img.src || img.url" loading="lazy" />
            </div>
          </div>
        </div>
      </div>

      <!-- 商品页 -->
      <div v-show="activePage === 'goods'" class="page">
        <div class="sec">
          <div class="page-row-title">该供应商的商品 <span class="sec-tip">（我看过的 {{ products.length }} 个）</span></div>
          <div v-if="!products.length" class="empty-tip">暂无浏览记录</div>
          <div v-for="p in products" :key="p.offer_id" class="prod-row" @click="openOffer(p.offer_id)">
            <img v-if="p.main_img_url" class="prod-img" :src="p.main_img_url" />
            <div v-else class="prod-img prod-img-empty">无图</div>
            <div class="prod-body">
              <div class="prod-title" :title="p.title || ''">{{ p.title || p.offer_id }}</div>
            <div class="prod-meta">
              <span>浏览 {{ p.view_count }} · 出现 {{ p.appear_count }}</span>
              <span v-if="p.last_viewed_at">最近 {{ fmtTs(p.last_viewed_at) }}</span>
              <span v-if="p.comment_count" class="prod-note">笔记：{{ stripHtml(p.my_comment) || p.comment_count + ' 条' }}</span>
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 信息页（供应商档案基础信息） -->
      <div v-show="activePage === 'info'" class="page">
        <div class="sec">
          <div class="page-row-title">供应商信息 <span class="sec-tip">（来自旺旺「档案」，自动保存）</span></div>
          <template v-if="supplierName">
            <div class="info-row"><span class="info-key">公司名称</span><span class="info-val strong">{{ supplierName }}</span></div>
            <div v-if="archiveInfo?.year" class="info-row"><span class="info-key">年限</span><span class="info-val">{{ archiveInfo.year }}</span></div>
            <template v-if="archiveInfo?.info">
              <div v-for="(v, k) in archiveInfo.info" :key="k" class="info-row">
                <span class="info-key">{{ k }}</span><span class="info-val">{{ v }}</span>
              </div>
            </template>
            <div v-if="!archiveInfo" class="empty-tip">档案信息待读取：切到该会话点一次旺旺「档案」Tab 后自动保存</div>
          </template>
          <div v-else class="empty-tip">未识别供应商，无法读取档案</div>
        </div>
        <div class="sec" v-if="supplierName">
          <div class="page-row-title">数据概览 <span class="sec-tip">（该供应商所有商品）</span></div>
          <div class="stat-cards">
            <div class="stat-card"><span class="sc-num">{{ supStats?.totals?.product_count ?? '—' }}</span><span class="sc-label">商品</span></div>
            <div class="stat-card"><span class="sc-num">{{ supStats?.totals?.view_count ?? '—' }}</span><span class="sc-label">浏览</span></div>
            <div class="stat-card"><span class="sc-num">{{ supStats?.totals?.appear_count ?? '—' }}</span><span class="sc-label">出现</span></div>
          </div>
          <div v-if="supStats?.last_view_at" class="info-row"><span class="info-key">最近浏览</span><span class="info-val">{{ fmtTs(supStats.last_view_at) }}</span></div>
          <HsTrendChart v-if="supStats?.daily?.length" :daily="supStats.daily" :height="130" />
          <div class="page-row-title" style="margin-top: 10px">浏览时段分布</div>
          <HsHourlyChart v-if="supStats?.hourly?.length" :hourly="supStats.hourly" :height="110" />
          <div class="page-row-title" style="margin-top: 10px">浏览热力图 <span class="sec-tip">（星期 × 小时）</span></div>
          <HsHeatmap v-if="supStats?.heatmap?.length" :heatmap="supStats.heatmap" :height="150" />
          <div class="page-row-title" style="margin-top: 10px">浏览时间轴</div>
          <div v-if="!supStats?.timeline?.length" class="empty-tip">暂无浏览记录</div>
          <div v-for="t in (supStats?.timeline || []).slice(0, 12)" :key="t.ts + t.offer_id" class="tl-row" @click="openOffer(t.offer_id)">
            <span class="tl-time">{{ fmtTs(t.ts) }}</span>
            <span class="tl-title" :title="t.title">{{ t.title || t.offer_id }}</span>
          </div>
          <div v-if="(supStats?.timeline || []).length > 12" class="empty-tip">仅显示最近 12 条</div>
        </div>
        <div class="sec">
          <div class="page-row-title">快捷跳转</div>
          <div v-if="offerId" class="offer-link-row" @click="openOffer(offerId)">当前询价商品 {{ offerId }} ↗</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alocs-panel {
  height: 100%;
  display: flex;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
  font-size: 13px;
  color: #333;
  box-sizing: border-box;
}

/* 左侧竖向导航 */
.side-nav {
  width: 56px;
  flex-shrink: 0;
  background: #f7f7f7;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  padding-top: 8px;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 9px 0;
  cursor: pointer;
  color: #888;
  border-left: 2px solid transparent;
}
.nav-item:hover { color: #ff5b00; background: #f0f0f0; }
.nav-item.active {
  color: #ff5b00;
  background: #fff;
  border-left-color: #ff5b00;
}
.nav-icon { font-size: 16px; line-height: 1.2; }
.nav-label { font-size: 11px; margin-top: 2px; }

/* 右侧内容区 */
.content-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.sup-bar {
  padding: 8px 10px 6px;
  background: #fffaf5;
  border-bottom: 1px solid #f5e8dc;
  flex-shrink: 0;
}
.sup-line { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.sup-name {
  font-size: 13px;
  font-weight: 600;
  color: #ff5b00;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 210px;
}
.login-id {
  flex-shrink: 0;
  font-size: 11px;
  color: #999;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 1px 6px;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sup-sub { display: flex; align-items: center; gap: 6px; }
.src-tag {
  font-size: 11px;
  color: #b0b0b0;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
  background: #fff;
}
.src-tag.ok { color: #ff5b00; border-color: #ffd2b8; }
.bind-hint { font-size: 11px; color: #b0b0b0; line-height: 1.4; }

/* 右侧页面容器：独立滚动 */
.page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.page-row-title {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}
.sec { padding: 8px 10px; border-bottom: 1px solid #f5f5f5; }
.sec-tip { color: #c0c0c0; font-weight: 400; }

/* 备注页 */
.editor-box {
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
}
.editor-box :deep(.rich-editor-wrap) { min-height: 150px; }
.others-box {
  margin: 8px 0 8px;
  max-height: 160px;
  overflow-y: auto;
}

/* 快捷话术 */
.phrase-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}
.phrase-chip {
  position: relative;
  border: 1px solid #eee;
  border-radius: 5px;
  padding: 4px 16px 4px 7px;
  font-size: 11px;
  color: #444;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #fafafa;
}
.phrase-chip:hover { border-color: #ffd2b8; background: #fffaf5; color: #ff5b00; }
.phrase-del {
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  color: #ccc;
  font-size: 12px;
  display: none;
  padding: 0 3px;
}
.phrase-chip:hover .phrase-del { display: inline; }
.phrase-del:hover { color: #ff4d4f; }
.phrase-add {
  display: flex;
  gap: 5px;
  margin-top: 7px;
}
.phrase-input {
  flex: 1;
  min-width: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 3px 7px;
  font-size: 11px;
  outline: none;
}
.phrase-input:focus { border-color: #ffb27a; }
.phrase-add-btn {
  border: none;
  background: #ff5b00;
  color: #fff;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
}
.phrase-add-btn:hover { background: #e65200; }
.phrase-tip { margin-top: 5px; font-size: 11px; color: #52c41a; }

/* 聊天记录 */
.chat-refresh {
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  float: right;
}
.chat-refresh:hover { color: #ff5b00; }
.chat-row {
  padding: 5px 0;
  border-top: 1px solid #f7f7f7;
}
.chat-row:first-of-type { border-top: none; }
.chat-row.self { background: #fffaf5; margin: 0 -5px; padding: 5px; border-radius: 4px; }
.chat-meta { display: flex; align-items: baseline; gap: 7px; margin-bottom: 1px; }
.chat-nick { font-size: 11px; font-weight: 600; color: #666; }
.chat-row.self .chat-nick { color: #ff5b00; }
.chat-time { font-size: 10px; color: #bbb; }
.chat-text {
  font-size: 12px;
  color: #444;
  line-height: 1.5;
  word-break: break-all;
  white-space: pre-wrap;
}
.chat-imgs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.chat-links { margin-top: 3px; display: flex; flex-direction: column; gap: 2px; }
.chat-link {
  font-size: 11px;
  color: #1677ff;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-link:hover { text-decoration: underline; }
.chat-img {
  max-width: 110px;
  max-height: 80px;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  object-fit: cover;
}

/* 商品列表 */
.prod-row {
  display: flex;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px solid #f7f7f7;
  cursor: pointer;
}
.prod-row:first-of-type { border-top: none; }
.prod-row:hover .prod-title { color: #ff5b00; }
.prod-img {
  width: 42px;
  height: 42px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.prod-img-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #ccc;
  background: #f5f5f5;
}
.prod-body { flex: 1; min-width: 0; }
.prod-title {
  font-size: 12px;
  line-height: 1.4;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.prod-meta {
  margin-top: 2px;
  font-size: 11px;
  color: #999;
  display: flex;
  gap: 8px;
  overflow: hidden;
}
.prod-note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #b8860b;
}

/* 信息页 */
.info-row {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  border-top: 1px solid #f7f7f7;
  font-size: 12px;
}
.info-row:first-of-type { border-top: none; }
.info-key { width: 70px; flex-shrink: 0; color: #999; }
.info-val { color: #444; word-break: break-all; }
.info-val.strong { color: #ff5b00; font-weight: 600; }

/* 数据概览 */
.stat-cards {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.stat-card {
  flex: 1;
  background: #fffaf5;
  border: 1px solid #ffeede;
  border-radius: 6px;
  padding: 7px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sc-num { font-size: 16px; font-weight: 700; color: #ff5b00; }
.sc-label { font-size: 10px; color: #b9986f; margin-top: 1px; }
.tl-row {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-top: 1px solid #f7f7f7;
  cursor: pointer;
  font-size: 11px;
}
.tl-row:first-of-type { border-top: none; }
.tl-row:hover .tl-title { color: #ff5b00; }
.tl-time { flex-shrink: 0; color: #bbb; }
.tl-title {
  flex: 1;
  min-width: 0;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.offer-link-row {
  font-size: 12px;
  color: #ff5b00;
  cursor: pointer;
}
.offer-link-row:hover { text-decoration: underline; }

.empty-tip {
  font-size: 12px;
  color: #bbb;
  padding: 6px 0;
}
</style>
