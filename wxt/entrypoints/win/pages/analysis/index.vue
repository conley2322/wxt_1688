<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useApiStore } from '@/stores/api/api.js'
import { api } from '@/utils/dataClient.js'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const store = useApiStore()

const loading = ref(false)
const stats = ref(null)
const range = ref(30) // 趋势图天数：7 / 14 / 30

let trendChart = null
let hourChart = null
const trendEl = ref(null)
const hourEl = ref(null)

// ── 监听商品，加载统计数据 ──
watch(() => store.currentOfferId, async (id) => {
  if (!id) return
  await loadStats(id)
}, { immediate: true })

async function loadStats(id) {
  loading.value = true
  try {
    const res = await api(`/api/v1/products/${id}/stats`, 'GET')
    if (res.code === 200) stats.value = res.data
  } finally {
    // 必须先关闭 loading，模板中的图表容器才会渲染
    loading.value = false
    await nextTick()
    if (stats.value) {
      renderTrend()
      renderHour()
    }
  }
}

// 他人数据开关是否开启（开启时 localapi 才返回 others_daily）
const showOthers = () => !!stats.value?.others_daily

function rangeData() {
  const daily = stats.value.daily || []
  const odaily = stats.value.others_daily || []
  return {
    mine: daily.slice(daily.length - range.value),
    others: odaily.slice(odaily.length - range.value),
  }
}

// ── 近 N 天出现 + 浏览双折线图（开启他人展示时追加两条虚线）──
function renderTrend() {
  if (!trendEl.value) return
  if (!trendChart) trendChart = echarts.init(trendEl.value)
  const { mine, others } = rangeData()
  const withOthers = showOthers()
  const legendData = withOthers
    ? ['出现', '浏览', '他人出现', '他人浏览']
    : ['出现', '浏览']
  const series = [
    {
      name: '出现', type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      data: mine.map(d => d.appear),
      itemStyle: { color: '#ff6a00' },
      areaStyle: { color: 'rgba(255,106,0,.08)' },
    },
    {
      name: '浏览', type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
      data: mine.map(d => d.view),
      itemStyle: { color: '#1677ff' },
      areaStyle: { color: 'rgba(22,119,255,.08)' },
    },
  ]
  if (withOthers) {
    series.push(
      {
        name: '他人出现', type: 'line', smooth: true, symbol: 'none',
        data: others.map(d => d.appear),
        lineStyle: { type: 'dashed', width: 1.5, color: '#ffb066' },
        itemStyle: { color: '#ffb066' },
      },
      {
        name: '他人浏览', type: 'line', smooth: true, symbol: 'none',
        data: others.map(d => d.view),
        lineStyle: { type: 'dashed', width: 1.5, color: '#79aefc' },
        itemStyle: { color: '#79aefc' },
      }
    )
  }
  trendChart.setOption({
    grid: { left: 28, right: 12, top: 28, bottom: 22 },
    tooltip: { trigger: 'axis' },
    legend: {
      data: legendData, top: 0, right: 0,
      itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#666' },
    },
    xAxis: {
      type: 'category', data: mine.map(d => d.date), boundaryGap: false,
      axisLine: { lineStyle: { color: '#eee' } },
      axisLabel: { color: '#999', fontSize: 10, interval: range.value > 14 ? 3 : 1 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', minInterval: 1,
      axisLabel: { color: '#999', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f5f5f5' } },
    },
    series,
  }, true)
}

function changeRange(days) {
  range.value = days
  renderTrend()
}

// ── 24 小时浏览时段柱状图 ──
function renderHour() {
  if (!hourEl.value) return
  if (!hourChart) hourChart = echarts.init(hourEl.value)
  const data = stats.value.hourly || []
  hourChart.setOption({
    grid: { left: 28, right: 12, top: 16, bottom: 22 },
    tooltip: {
      trigger: 'axis',
      formatter: (p) => `${p[0].name}时 · 浏览 ${p[0].value} 次`,
    },
    xAxis: {
      type: 'category',
      data: data.map((_, i) => i),
      axisLine: { lineStyle: { color: '#eee' } },
      axisLabel: { color: '#999', fontSize: 10, interval: 2 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', minInterval: 1,
      axisLabel: { color: '#999', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f5f5f5' } },
    },
    series: [{
      type: 'bar', data, barWidth: '60%',
      itemStyle: { color: '#1677ff', borderRadius: [2, 2, 0, 0] },
    }],
  })
}

// ── 时间格式化 ──
function fmtDateTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function onResize() {
  trendChart?.resize()
  hourChart?.resize()
}

onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  trendChart?.dispose()
  hourChart?.dispose()
})
</script>

<template>
  <div class="analysis-page">
    <div v-if="!store.currentOfferId || loading" class="tip">{{ loading ? '加载中…' : '暂无数据' }}</div>

    <template v-else-if="stats">
      <!-- 统计卡片 -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-num blue">{{ stats.totals.view_count }}</div>
          <div class="stat-label">累计浏览</div>
        </div>
        <div class="stat-card">
          <div class="stat-num orange">{{ stats.totals.appear_count }}</div>
          <div class="stat-label">累计出现</div>
        </div>
        <div class="stat-card">
          <div class="stat-num green">{{ stats.totals.comment_count }}</div>
          <div class="stat-label">我的笔记</div>
        </div>
        <div class="stat-card">
          <div class="stat-num purple">{{ stats.supplier_viewed_count }}</div>
          <div class="stat-label">同店已看商品</div>
        </div>
        <!-- 他人数据（仅在开关开启时显示） -->
        <template v-if="showOthers()">
          <div class="stat-card">
            <div class="stat-num blue-light">{{ stats.others_totals.view_count }}</div>
            <div class="stat-label">他人浏览</div>
          </div>
          <div class="stat-card">
            <div class="stat-num orange-light">{{ stats.others_totals.appear_count }}</div>
            <div class="stat-label">他人出现</div>
          </div>
        </template>
      </div>

      <!-- 趋势图 -->
      <div class="chart-block">
        <div class="block-head">
          <span class="block-title">出现 / 浏览趋势</span>
          <span class="range-btns">
            <span
              v-for="d in [7, 14, 30]" :key="d"
              class="range-btn" :class="{ active: range === d }"
              @click="changeRange(d)"
            >{{ d }}天</span>
          </span>
        </div>
        <div ref="trendEl" class="chart-box"></div>
      </div>

      <!-- 时段分布图 -->
      <div class="chart-block">
        <div class="block-head">
          <span class="block-title">浏览时段分布</span>
          <span class="block-sub">一天 24 小时</span>
        </div>
        <div ref="hourEl" class="chart-box"></div>
      </div>

      <!-- 时间信息 -->
      <div class="time-info">
        <div class="time-row">
          <span class="time-label">首次浏览</span>
          <span class="time-val">{{ fmtDateTime(stats.first_viewed_at) }}</span>
        </div>
        <div class="time-row">
          <span class="time-label">最近浏览</span>
          <span class="time-val">{{ fmtDateTime(stats.last_viewed_at) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.analysis-page {
  display: flex; flex-direction: column;
  min-height: 100%; padding: 10px; gap: 10px;
}
.tip { text-align: center; color: #999; font-size: 12px; padding: 40px 0; }

/* 统计卡片 */
.stat-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.stat-card {
  background: #fafbfc; border: 1px solid #f0f0f0; border-radius: 8px;
  padding: 10px 6px; text-align: center;
}
.stat-num { font-size: 20px; font-weight: 700; line-height: 1.2; }
.stat-num.blue { color: #1677ff; }
.stat-num.orange { color: #ff6a00; }
.stat-num.green { color: #52c41a; }
.stat-num.purple { color: #9b59b6; }
.stat-num.blue-light { color: #79aefc; }
.stat-num.orange-light { color: #ffb066; }
.stat-label { font-size: 11px; color: #999; margin-top: 2px; }

/* 图表区块 */
.chart-block {
  background: #fafbfc; border: 1px solid #f0f0f0; border-radius: 8px;
  padding: 10px 8px 6px;
}
.block-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 6px;
}
.block-title { font-size: 12px; font-weight: 600; color: #333; }
.block-sub { font-size: 11px; color: #bbb; }
.range-btns { display: flex; gap: 4px; }
.range-btn {
  font-size: 11px; color: #999; padding: 1px 8px; border-radius: 10px;
  cursor: pointer; border: 1px solid #e8e8e8;
}
.range-btn.active { color: #1677ff; border-color: #1677ff; background: #f0f7ff; }
.chart-box { width: 100%; height: 170px; }

/* 时间信息 */
.time-info {
  background: #fafbfc; border: 1px solid #f0f0f0; border-radius: 8px;
  padding: 8px 12px;
}
.time-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0; font-size: 12px;
}
.time-label { color: #999; }
.time-val { color: #333; }
</style>
