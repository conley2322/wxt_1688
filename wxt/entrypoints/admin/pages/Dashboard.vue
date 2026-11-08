<script setup>
import { ref, onMounted } from 'vue'
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
</script>

<template>
  <section v-loading="loading">
    <h2 class="page-title">概览</h2>

    <!-- 统计卡片（全部来自本地库真实数据） -->
    <el-row :gutter="12" style="margin-bottom:16px" v-if="overview">
      <el-col :span="4"><el-card shadow="hover"><el-statistic title="供应商" :value="overview.totals.supplier_count"><template #prefix><el-icon color="#c9975c"><User /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="4"><el-card shadow="hover"><el-statistic title="商品" :value="overview.totals.product_count"><template #prefix><el-icon color="#409eff"><Goods /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="4"><el-card shadow="hover"><el-statistic title="浏览次数" :value="overview.totals.view_count"><template #prefix><el-icon color="#c9975c"><View /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="4"><el-card shadow="hover"><el-statistic title="出现次数" :value="overview.totals.appear_count"><template #prefix><el-icon color="#7d96bd"><Histogram /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="4"><el-card shadow="hover"><el-statistic title="笔记" :value="overview.totals.comment_count"><template #prefix><el-icon color="#67c23a"><Notebook /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="4"><el-card shadow="hover"><el-statistic title="聊天消息" :value="overview.totals.chat_count"><template #prefix><el-icon color="#7d96bd"><ChatDotRound /></el-icon></template></el-statistic></el-card></el-col>
    </el-row>

    <!-- 切换 tab：一个 tab 一块数据 -->
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
      <div v-if="activeTab === 'suppliers'">
        <div class="ov-pane-title">供应商活跃排行<span class="ov-hint">看了多少 · 什么时候看的 · 点击行进「我的货源」 · 滚到底加载更多</span></div>
        <div class="ov-scroll" v-if="suppliers.length" @scroll="onSuppliersScroll">
          <table class="ov-table">
            <thead>
              <tr><th>供应商</th><th>商品数</th><th>浏览</th><th>出现</th><th>首次浏览</th><th>最近浏览</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in suppliers" :key="s.name" @click="openSupplier(s.name)" title="点击进「我的货源」查看该供应商">
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
      <div v-if="activeTab === 'trend'">
        <div class="ov-pane-title">近 30 天 出现 / 浏览趋势<span class="ov-hint">全部商品汇总</span></div>
        <HsTrendChart :daily="overview.daily" :height="280" />
      </div>

      <!-- 24 小时时段分布 -->
      <div v-if="activeTab === 'hourly'">
        <div class="ov-pane-title">浏览时段分布<span class="ov-hint">24 小时 · 全部商品</span></div>
        <HsHourlyChart :hourly="overview.hourly" :height="260" />
      </div>

      <!-- 星期×小时热力图 -->
      <div v-if="activeTab === 'heatmap'">
        <div class="ov-pane-title">浏览热力图<span class="ov-hint">星期 × 小时 · 颜色越深看得越多</span></div>
        <HsHeatmap :heatmap="overview.heatmap" :height="280" />
      </div>

      <!-- 全局浏览时间轴 -->
      <div v-if="activeTab === 'timeline'">
        <div class="ov-pane-title">最近浏览时间轴<span class="ov-hint">跨全部供应商 · 点行跳商品 · 滚到底自动加载</span></div>
        <div class="ov-scroll" @scroll="onTimelineScroll">
          <div v-if="!timeline.length" class="ov-empty">暂无浏览记录</div>
          <div v-for="(t, i) in timeline" :key="t.ts + '-' + t.offer_id + '-' + i" class="ov-tl-row" @click="openProduct(t)">
            <span class="ov-tl-time">{{ fmtTs(t.ts) }}</span>
            <span class="ov-tl-title" :title="t.title">{{ t.title || t.offer_id }}</span>
            <span class="ov-tl-sup">{{ t.supplier_name }}</span>
          </div>
          <div v-if="timelineLoading" class="ov-tl-foot">加载中…</div>
          <div v-else-if="timelineEnd && timeline.length" class="ov-tl-foot">没有更多了</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0 0 20px; }

/* 切换 tab（与「我的货源」右栏页签同款风格） */
.ov-tabs {
  display: flex;
  gap: 4px;
  padding: 0 4px;
  border-bottom: 1px solid #ebeef5;
}
.ov-tab {
  font-size: 13px;
  color: #909399;
  cursor: pointer;
  padding: 8px 14px;
  border-bottom: 2px solid transparent;
  user-select: none;
}
.ov-tab:hover { color: #c9975c; }
.ov-tab.on { color: #c9975c; font-weight: 600; border-bottom-color: #c9975c; }

.ov-body { padding: 14px 4px; }
.ov-pane-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; }
.ov-hint { font-weight: 400; font-size: 11px; color: #a8abb2; margin-left: 8px; }
.ov-empty { text-align: center; font-size: 12px; color: #bbb; padding: 30px 0; }

/* 供应商排行表 */
.ov-table { width: 100%; border-collapse: collapse; background: #fff; }
.ov-table th {
  text-align: left; font-size: 12px; color: #a8abb2; font-weight: 400;
  padding: 8px 10px; border-bottom: 1px solid #f2f3f5;
  position: sticky; top: 0; background: #fff; z-index: 1;
}
.ov-table td { padding: 9px 10px; border-bottom: 1px solid #f7f8fa; font-size: 13px; }
.ov-table tbody tr { cursor: pointer; }
.ov-table tbody tr:hover td { background: #faf7f3; }
.ov-table .rname { color: #303133; font-weight: 600; }
.ov-table .num { color: #c9975c; font-weight: 600; }
.ov-table .tm { color: #a8abb2; font-size: 12px; white-space: nowrap; }

/* 可滚动数据区（供应商排行 / 浏览时间轴共用） */
.ov-scroll { max-height: calc(100vh - 320px); min-height: 200px; overflow-y: auto; }
.ov-tl-row {
  display: flex; gap: 10px; align-items: baseline;
  padding: 7px 4px; border-top: 1px solid #f7f4ef;
  cursor: pointer; font-size: 13px;
}
.ov-tl-row:hover .ov-tl-title { color: #c9975c; }
.ov-tl-time { flex-shrink: 0; width: 130px; color: #c4b08c; font-size: 12px; }
.ov-tl-title { flex: 1; min-width: 0; color: #5b4a35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-tl-sup { flex-shrink: 0; max-width: 180px; color: #a8abb2; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-tl-foot { text-align: center; font-size: 11px; color: #bbb; padding: 10px 0; }
</style>