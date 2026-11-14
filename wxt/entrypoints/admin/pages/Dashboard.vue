<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../utils/useApi.js'
import HsTrendChart from '@/components/HsTrendChart.vue'
import HsHourlyChart from '@/components/HsHourlyChart.vue'
import HsHeatmap from '@/components/HsHeatmap.vue'

const router = useRouter()

const loading = ref(false)
const overview = ref(null)
const activeTab = ref('suppliers')
const TABS = [
  { key: 'suppliers', label: '供应商' },
  { key: 'trend', label: '趋势' },
  { key: 'hourly', label: '时段分布' },
  { key: 'heatmap', label: '热力图' },
  { key: 'timeline', label: '浏览时间轴' },
]

// 时间轴分页（第一页随 overview 返回，滚到底走 /stats/timeline 续载）
const timeline = ref([])
const timelineLoading = ref(false)
const timelineEnd = ref(false)

// 供应商排行分页（第一页 50 条随 overview 返回，滚到底走 /stats/suppliers 续载）
const suppliers = ref([])
const suppliersLoading = ref(false)
const suppliersEnd = ref(false)

// 连续同一商品 5 分钟内的浏览合并成一行 ×N，避免同一商品刷屏
const timelineGrouped = computed(() => {
  const out = []
  for (const t of timeline.value) {
    const last = out[out.length - 1]
    if (last && last.offer_id === t.offer_id && t.ts - last.lastTs < 5 * 60000) {
      last.count++
      last.lastTs = t.ts
    } else {
      out.push({
        key: `${t.ts}-${t.offer_id}-${out.length}`,
        ts: t.ts,
        offer_id: t.offer_id,
        title: t.title || '',
        hasTitle: !!(t.title && t.title !== t.offer_id),
        supplier_name: t.supplier_name || '',
        count: 1,
        lastTs: t.ts,
      })
    }
  }
  return out
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await api('/api/v1/stats/overview', 'GET')
    if (res.code === 200) {
      overview.value = res.data
      timeline.value = res.data.timeline || []
      timelineEnd.value = timeline.value.length < 50
      suppliers.value = res.data.suppliers || []
      suppliersEnd.value = suppliers.value.length >= res.data.totals.supplier_count
    }
  } catch (e) { console.error('[Dashboard] 加载统计失败:', e) }
  finally { loading.value = false }
}

async function loadMoreSuppliers() {
  if (suppliersLoading.value || suppliersEnd.value || !suppliers.value.length) return
  suppliersLoading.value = true
  try {
    const res = await api(`/api/v1/stats/suppliers?offset=${suppliers.value.length}&limit=50`, 'GET')
    if (res.code === 200) {
      const items = res.data || []
      suppliers.value.push(...items)
      if (items.length < 50 || suppliers.value.length >= (res.total || 0)) suppliersEnd.value = true
    }
  } catch (e) { console.error('[Dashboard] 供应商排行加载失败:', e) }
  finally { suppliersLoading.value = false }
}

function onSuppliersScroll(e) {
  const el = e.target
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) loadMoreSuppliers()
}

async function loadMoreTimeline() {
  if (timelineLoading.value || timelineEnd.value || !timeline.value.length) return
  timelineLoading.value = true
  try {
    const last = timeline.value[timeline.value.length - 1]
    const res = await api(`/api/v1/stats/timeline?before=${last.ts}&limit=50`, 'GET')
    if (res.code === 200) {
      const items = res.data || []
      timeline.value.push(...items)
      if (items.length < 50) timelineEnd.value = true
    }
  } catch (e) { console.error('[Dashboard] 时间轴加载失败:', e) }
  finally { timelineLoading.value = false }
}

function onTimelineScroll(e) {
  const el = e.target
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) loadMoreTimeline()
}

function openProduct(t) {
  window.open(`https://detail.1688.com/offer/${t.offer_id}.html`, '_blank')
}

function openSupplier(name) {
  router.push({ path: '/sources', query: { name } })
}

function pad(n) { return String(n).padStart(2, '0') }
function fmtTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtNum(v) { return Number(v || 0).toLocaleString('en-US') }
</script>

<template>
  <section v-loading="loading">
    <h2 class="page-title">概览</h2>

    <!-- 统计小方牌（弹性布局，全部来自本地库真实数据） -->
    <div class="ov-cards" v-if="overview">
      <div class="ov-card">
        <span class="ovc-icon" style="background:#faf1e6"><el-icon color="#c9975c"><User /></el-icon></span>
        <div class="ovc-meta"><span class="ovc-label">供应商</span><span class="ovc-num">{{ fmtNum(overview.totals.supplier_count) }}</span></div>
      </div>
      <div class="ov-card">
        <span class="ovc-icon" style="background:#edf4fd"><el-icon color="#409eff"><Goods /></el-icon></span>
        <div class="ovc-meta"><span class="ovc-label">商品</span><span class="ovc-num">{{ fmtNum(overview.totals.product_count) }}</span></div>
      </div>
      <div class="ov-card">
        <span class="ovc-icon" style="background:#fff3e9"><el-icon color="#ff9d4d"><View /></el-icon></span>
        <div class="ovc-meta"><span class="ovc-label">浏览次数</span><span class="ovc-num">{{ fmtNum(overview.totals.view_count) }}</span></div>
      </div>
      <div class="ov-card">
        <span class="ovc-icon" style="background:#eef3f9"><el-icon color="#7d96bd"><Histogram /></el-icon></span>
        <div class="ovc-meta"><span class="ovc-label">出现次数</span><span class="ovc-num">{{ fmtNum(overview.totals.appear_count) }}</span></div>
      </div>
      <div class="ov-card">
        <span class="ovc-icon" style="background:#f0f9eb"><el-icon color="#67c23a"><Notebook /></el-icon></span>
        <div class="ovc-meta"><span class="ovc-label">笔记</span><span class="ovc-num">{{ fmtNum(overview.totals.comment_count) }}</span></div>
      </div>
      <div class="ov-card">
        <span class="ovc-icon" style="background:#f4f4f5"><el-icon color="#909399"><ChatDotRound /></el-icon></span>
        <div class="ovc-meta"><span class="ovc-label">聊天消息</span><span class="ovc-num">{{ fmtNum(overview.totals.chat_count) }}</span></div>
      </div>
    </div>

    <!-- 切换 tab（胶囊页签）：一个 tab 一块数据 -->
    <div class="ov-tabs">
      <span
        v-for="t in TABS"
        :key="t.key"
        class="ov-tab"
        :class="{ on: activeTab === t.key }"
        @click="activeTab = t.key"
      >{{ t.label }}</span>
    </div>

    <div class="ov-body" v-if="overview">
      <!-- 供应商活跃排行 -->
      <div v-if="activeTab === 'suppliers'" class="ov-pane">
        <div class="ov-pane-title">供应商活跃排行<span class="ov-hint">看了多少 · 什么时候看的 · 点击行进「我的货源」 · 滚到底加载更多</span></div>
        <div class="ov-scroll" v-if="suppliers.length" @scroll="onSuppliersScroll">
          <table class="ov-table">
            <thead>
              <tr><th class="rank-th"></th><th>供应商</th><th>商品数</th><th>浏览</th><th>出现</th><th>首次浏览</th><th>最近浏览</th></tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in suppliers" :key="s.name" @click="openSupplier(s.name)" title="点击进「我的货源」查看该供应商">
                <td class="rank" :class="{ top: i < 3 }">{{ i + 1 }}</td>
                <td class="rname">{{ s.name }}</td>
                <td class="num">{{ s.product_count }}</td>
                <td class="num">{{ s.view_count }}</td>
                <td>{{ s.appear_count }}</td>
                <td class="tm">{{ fmtTs(s.first_view_at) }}</td>
                <td class="tm">{{ fmtTs(s.last_view_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="suppliersLoading" class="ov-tl-foot">加载中…</div>
          <div v-else-if="suppliersEnd" class="ov-tl-foot">没有更多了（共 {{ overview.totals.supplier_count }} 个供应商）</div>
        </div>
        <el-empty v-else description="暂无浏览记录，去 1688 看几个商品后这里就有数据了" :image-size="60" />
      </div>

      <!-- 近 30 天趋势 -->
      <div v-if="activeTab === 'trend'" class="ov-pane">
        <div class="ov-pane-title">近 30 天 出现 / 浏览趋势<span class="ov-hint">全部商品汇总</span></div>
        <HsTrendChart :daily="overview.daily" :height="280" />
      </div>

      <!-- 24 小时时段分布 -->
      <div v-if="activeTab === 'hourly'" class="ov-pane">
        <div class="ov-pane-title">浏览时段分布<span class="ov-hint">24 小时 · 全部商品</span></div>
        <HsHourlyChart :hourly="overview.hourly" :height="260" />
      </div>

      <!-- 星期×小时热力图 -->
      <div v-if="activeTab === 'heatmap'" class="ov-pane">
        <div class="ov-pane-title">浏览热力图<span class="ov-hint">星期 × 小时 · 颜色越深看得越多</span></div>
        <HsHeatmap :heatmap="overview.heatmap" :height="280" />
      </div>

      <!-- 全局浏览时间轴 -->
      <div v-if="activeTab === 'timeline'" class="ov-pane">
        <div class="ov-pane-title">最近浏览时间轴<span class="ov-hint">跨全部供应商 · 5 分钟内同一商品合并 ×N · 点行跳商品 · 滚到底自动加载</span></div>
        <div class="ov-scroll" @scroll="onTimelineScroll">
          <div v-if="!timeline.length" class="ov-empty">暂无浏览记录</div>
          <div v-for="g in timelineGrouped" :key="g.key" class="ov-tl-card" @click="openProduct(g)">
            <span class="ov-tl-time">{{ fmtTs(g.ts) }}</span>
            <span class="ov-tl-main">
              <span v-if="g.hasTitle" class="ov-tl-title" :title="g.title">{{ g.title }}</span>
              <span v-else class="ov-tl-raw">商品 {{ g.offer_id }}<i class="ov-tl-ntag">未采集标题</i></span>
            </span>
            <span v-if="g.count > 1" class="ov-tl-count">×{{ g.count }}</span>
            <span v-if="g.supplier_name" class="ov-tl-sup" :title="g.supplier_name">{{ g.supplier_name }}</span>
          </div>
          <div v-if="timelineLoading" class="ov-tl-foot">加载中…</div>
          <div v-else-if="timelineEnd && timeline.length" class="ov-tl-foot">没有更多了</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0 0 16px; }

/* 统计小方牌：弹性一行，窄屏自动换行 */
.ov-cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.ov-card {
  flex: 1 1 190px;
  min-width: 160px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #f0ebe4;
  border-radius: 12px;
  padding: 14px 16px;
  box-sizing: border-box;
  transition: box-shadow 0.15s;
}
.ov-card:hover { box-shadow: 0 2px 10px rgba(201, 151, 92, 0.12); }
.ovc-icon {
  width: 34px; height: 34px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ovc-meta { display: flex; flex-direction: column; min-width: 0; }
.ovc-label { font-size: 11px; color: #a8abb2; }
.ovc-num { font-size: 18px; font-weight: 700; color: #303133; line-height: 1.25; }

/* 切换 tab（胶囊页签） */
.ov-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.ov-tab {
  font-size: 12px; color: #909399; cursor: pointer;
  padding: 4px 14px; border-radius: 14px;
  background: #fff; border: 1px solid #ebeef5;
  user-select: none;
}
.ov-tab:hover { color: #c9975c; border-color: #e5c9a8; }
.ov-tab.on { color: #c9975c; font-weight: 600; background: #faf3ea; border-color: #e0c3a0; }

.ov-body { padding: 0; }

/* 内容卡片 */
.ov-pane {
  background: #fff;
  border: 1px solid #f0ebe4;
  border-radius: 12px;
  padding: 14px 16px;
}
.ov-pane-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
.ov-hint { font-weight: 400; font-size: 11px; color: #a8abb2; margin-left: 8px; }
.ov-empty { text-align: center; font-size: 12px; color: #bbb; padding: 30px 0; }

/* 供应商排行表 */
.ov-table { width: 100%; border-collapse: collapse; }
.ov-table th {
  text-align: left; font-size: 12px; color: #a8abb2; font-weight: 400;
  padding: 8px 10px; border-bottom: 1px solid #f2f3f5;
  position: sticky; top: 0; background: #fff; z-index: 1;
}
.ov-table td { padding: 9px 10px; border-bottom: 1px solid #f7f8fa; font-size: 13px; }
.ov-table tbody tr { cursor: pointer; }
.ov-table tbody tr:hover td { background: #faf7f3; }
.ov-table .rank { color: #c0c4cc; font-size: 12px; width: 34px; }
.ov-table .rank.top { color: #ff5b00; font-weight: 700; }
.ov-table .rname { color: #303133; font-weight: 600; }
.ov-table .num { color: #c9975c; font-weight: 600; }
.ov-table .tm { color: #a8abb2; font-size: 12px; white-space: nowrap; }

/* 可滚动数据区（供应商排行 / 浏览时间轴共用） */
.ov-scroll { max-height: calc(100vh - 340px); min-height: 200px; overflow-y: auto; }

/* 浏览时间轴：卡片行 */
.ov-tl-card {
  display: flex; gap: 10px; align-items: center;
  padding: 8px 12px; margin-bottom: 6px;
  background: #fffdfa;
  border: 1px solid #f5f1ea; border-radius: 8px;
  cursor: pointer; font-size: 13px;
}
.ov-tl-card:hover { border-color: #e8d5bd; background: #fdf9f3; }
.ov-tl-time {
  flex-shrink: 0;
  background: #f7f3ec; border-radius: 4px;
  padding: 2px 7px; color: #b08d5f; font-size: 11px;
  white-space: nowrap;
}
.ov-tl-main { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-tl-title { color: #5b4a35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-tl-card:hover .ov-tl-title { color: #c9975c; }
.ov-tl-raw { color: #909399; font-size: 12px; }
.ov-tl-ntag {
  font-style: normal; font-size: 10px; color: #c0c4cc;
  border: 1px dashed #dcdfe6; border-radius: 3px;
  padding: 0 4px; margin-left: 6px;
}
.ov-tl-count {
  flex-shrink: 0; font-size: 11px; font-weight: 600;
  color: #ff5b00; background: #fff3e9;
  border-radius: 8px; padding: 1px 7px;
}
.ov-tl-sup {
  flex-shrink: 0; max-width: 200px;
  background: #f5f7fa; color: #8a94a6;
  border-radius: 10px; padding: 2px 9px; font-size: 11px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ov-tl-foot { text-align: center; font-size: 11px; color: #bbb; padding: 10px 0; }
</style>
