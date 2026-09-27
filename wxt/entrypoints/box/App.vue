<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, AxisPointerComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// box1 图表按需引入（减小打包体积）
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, AxisPointerComponent, CanvasRenderer])

const props = defineProps(['parentEl', 'offerId', 'batchCache'])

// 父元素自适应
if (props.parentEl) {
  props.parentEl.style.height = 'auto'
}

// ── 从父元素提取 offer_id ──
const href = props.parentEl?.getAttribute('href') || ''
const data_renderkey = props.parentEl?.getAttribute('data-renderkey') || ''
const data_aplus = props.parentEl?.getAttribute('data-aplus-report') || ''
const link_element = props.parentEl?.querySelector('a[href*="offerId="]') || props.parentEl

const match_href = href?.match(/offerId=(\d+)/)?.[1]
const match_renderkey = data_renderkey?.match(/_(\d+)$/)?.[1]
const match_offerId = data_aplus?.match(/offerId@(\d+)/)?.[1]
const match_objectId = data_aplus?.match(/object_id@(\d+)/)?.[1]
const match_link_href = link_element?.href?.match(/offerId=(\d+)/)?.[1]

const offer_id = props.offerId || match_renderkey || match_href || match_offerId || match_objectId || match_link_href

// ── 从批量缓存中读数据（单机版：全部是自己的数据）──
const info = computed(() => props.batchCache?.[offer_id] || null)

// 两个独立计数：出现次数（列表页刷出即 +1）/ 浏览次数（点进详情页 +1）
const appearCount = computed(() => info.value?.appear_count ?? 0)
const viewCount = computed(() => info.value?.view_count ?? 0)
const iHaveViewed = computed(() => info.value?.i_have_viewed ?? false)

// box2：供应商维度 —— 同供应商下我浏览过的商品数（去重，0 也显示）
const supplierViewedCount = computed(() => info.value?.supplier_viewed_count ?? 0)

// ── 他人数据（已在 localapi 按三个开关裁剪）──
const others = computed(() => info.value?.others || { appear_count: 0, view_count: 0, comments: [] })
const othersComments = computed(() => others.value.comments || [])
const hasOthers = computed(() =>
  others.value.view_count > 0 || others.value.appear_count > 0 || othersComments.value.length > 0
)

// 跳转商品详情页（无论原卡片是否带链接，box 面板始终提供入口）
function goProduct() {
  window.open(`https://detail.1688.com/offer/${offer_id}.html`, '_blank', 'noopener')
}

// 留言时间格式化
function fmtTime(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// 昵称 → 稳定头像底色
const AVATAR_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
function avatarColor(name) {
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── box1 上下双图：上「出现」面积折线 / 下「浏览」细柱，共享时间轴联动 ──
// 固定展示近 30 天（数据源为近 50 天，前端切片）
const slicedTimeline = computed(() => {
  const t = info.value?.my_views_timeline
  return t ? t.slice(-30) : []
})
// 近 30 天两个计数任一有记录就显示
const hasChartData = computed(() => slicedTimeline.value.some(x => x.appear > 0 || x.view > 0))

const chartEl = ref(null)
let chartInstance = null

function renderChart() {
  const timeline = slicedTimeline.value
  // 切片为空时不渲染（正常不会发生：hasChartData 基于 50 天数据判定）
  if (!chartEl.value || timeline.length === 0) {
    if (chartInstance) { chartInstance.dispose(); chartInstance = null }
    return
  }
  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value)
  }
  const dates = timeline.map(t => t.date)
  // 日期刻度稀疏化：约 5~6 个刻度点
  const labelInterval = Math.floor(timeline.length / 5)
  const hideAxis = { show: false }
  chartInstance.setOption({
    // 两个 grid：上 86px 高（出现），下 60px 高（浏览），间距 6px
    grid: [
      { left: 30, right: 8, top: 2, height: 86 },
      { left: 30, right: 8, top: 94, height: 60 }
    ],
    // 悬停时上下竖向指示线联动
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { show: false },
      lineStyle: { color: '#c0c4cc', type: 'dashed' }
    },
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: 11 },
      // params 只含当前 grid 系列，用 dataIndex 回查两类数据
      formatter: ps => {
        const t = timeline[ps[0].dataIndex]
        return `${t.date}<br/>出现 ${t.appear} 次<br/>浏览 ${t.view} 次`
      }
    },
    xAxis: [
      {
        type: 'category', data: dates, gridIndex: 0,
        axisLabel: hideAxis, axisLine: hideAxis, axisTick: hideAxis
      },
      {
        type: 'category', data: dates, gridIndex: 1,
        axisLabel: { fontSize: 8, interval: labelInterval, color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value', minInterval: 1, gridIndex: 0,
        axisLabel: { fontSize: 8, color: '#b0b7c3' },
        splitLine: { lineStyle: { color: '#f3f4f6' } }
      },
      {
        type: 'value', minInterval: 1, gridIndex: 1,
        axisLabel: { fontSize: 8, color: '#c9b08c' },
        splitLine: { lineStyle: { color: '#f7f4ef' } }
      }
    ],
    series: [
      {
        name: '出现',
        type: 'line',
        xAxisIndex: 0, yAxisIndex: 0,
        data: timeline.map(t => t.appear),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#8faedd' },
        itemStyle: { color: '#8faedd' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(143,174,221,0.32)' },
            { offset: 1, color: 'rgba(143,174,221,0.02)' }
          ])
        }
      },
      {
        name: '浏览',
        type: 'bar',
        xAxisIndex: 1, yAxisIndex: 1,
        data: timeline.map(t => t.view),
        barMaxWidth: 6,
        itemStyle: { color: '#c9975c', borderRadius: [2, 2, 0, 0] }
      }
    ]
  }, true)
}

onMounted(() => nextTick(renderChart))
onUnmounted(() => { chartInstance?.dispose(); chartInstance = null })
watch(() => info.value?.my_views_timeline, () => nextTick(renderChart))
watch(hasChartData, (v) => { if (v) nextTick(renderChart) })

// 小圆点颜色：绿色=看过，灰色=没看过
const dotColor = computed(() => (iHaveViewed.value ? '#52c41a' : '#d9d9d9'))
</script>

<template>
  <template v-if="offer_id">
    <div class="box-card box-main-card">
      <div class="box-row">
        <!-- 小圆点 -->
        <span class="box-dot" :style="{ background: dotColor }"></span>

        <!-- 出现次数（列表页刷出即 +1） -->
        <span class="box-stat" title="出现次数：每次页面刷出这个商品 +1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          出现 {{ appearCount }}
        </span>

        <!-- 浏览次数（点进详情页 +1） -->
        <span class="box-stat" :style="{ color: iHaveViewed ? '#c9975c' : '#bbb' }" title="浏览次数：点进商品详情页 +1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          浏览 {{ viewCount }}
        </span>

        <!-- 他人计数（蓝色系，区分自己的橙色） -->
        <template v-if="others.appear_count > 0">
          <span class="box-stat others-stat" title="其他成员看到该商品的次数">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            他人出现 {{ others.appear_count }}
          </span>
        </template>
        <template v-if="others.view_count > 0">
          <span class="box-stat others-stat" title="其他成员浏览该商品详情页的次数">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            他人浏览 {{ others.view_count }}
          </span>
        </template>

        <!-- 跳转商品（无论原卡片是否有链接，始终提供） -->
        <span class="go-link" @click="goProduct">跳转商品 ↗</span>
      </div>
    </div>

    <!-- box1：上下双图（出现面积折线 / 浏览细柱，近 30 天），有记录才出现 -->
    <div v-if="hasChartData" class="box-card box1-card">
      <div ref="chartEl" class="box1-chart"></div>
    </div>

    <!-- box2：同供应商已看商品数（始终显示，无记录显示 0） -->
    <div class="box-card box2-card">
      <div class="box-row">
        <span
          class="box-stat box2-stat"
          :style="{ color: supplierViewedCount > 0 ? '#c9975c' : '#bbb' }"
          :title="`同供应商「${info?.supplier_name || '未知'}」已浏览 ${supplierViewedCount} 个商品`"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          同供应商已看 {{ supplierViewedCount }} 个商品
        </span>
      </div>
    </div>

    <!-- box3：团队留言（他人笔记），有才显示 -->
    <div v-if="othersComments.length" class="box-card box3-card">
      <div class="box3-title">团队留言 · {{ othersComments.length }}</div>
      <div v-for="c in othersComments" :key="c.id" class="others-item">
        <span class="others-avatar" :style="{ background: avatarColor(c.nickname) }">
          {{ (c.nickname || '?').slice(0, 1) }}
        </span>
        <div class="others-body">
          <div class="others-meta">
            <span class="others-name">{{ c.nickname || '匿名' }}</span>
            <span class="others-time">{{ fmtTime(c.updated_at || c.created_at) }}</span>
          </div>
          <div class="others-text" v-html="c.text"></div>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.box-card {
  height: 32px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
.box-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  justify-content: flex-start;
  width: 100%;
}
.box-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.box-stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #888;
  flex-shrink: 0;
}
.box-stat svg {
  opacity: 0.5;
  flex-shrink: 0;
}
/* 首卡：统计项增多，允许换行、高度自适应 */
.box-main-card {
  height: auto;
  min-height: 32px;
}
.box-main-card .box-row {
  flex-wrap: wrap;
  row-gap: 3px;
}
/* 他人计数：蓝色系 */
.others-stat {
  color: #3b82f6;
}
.others-stat svg {
  opacity: 0.7;
}
/* 跳转商品链接：靠右 */
.go-link {
  margin-left: auto;
  font-size: 11px;
  color: #ff6a00;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
}
.go-link:hover {
  text-decoration: underline;
}
/* ── box3：团队留言 ── */
.box3-card {
  height: auto;
  padding: 6px 8px;
  display: block;
}
.box3-title {
  font-size: 11px;
  color: #888;
  margin-bottom: 4px;
}
.others-item {
  display: flex;
  gap: 6px;
  padding: 3px 0;
}
.others-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.others-body {
  min-width: 0;
  flex: 1;
}
.others-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.others-name {
  font-size: 11px;
  color: #333;
  font-weight: 600;
}
.others-time {
  font-size: 10px;
  color: #bbb;
}
.others-text {
  font-size: 11px;
  color: #555;
  line-height: 1.5;
  word-break: break-all;
}
.others-text :deep(p) {
  margin: 0;
}
.others-text :deep(img) {
  max-width: 100%;
}
/* ── box1：上下双图（出现面积折线 / 浏览细柱）── */
.box1-card {
  height: auto;
  padding: 4px 8px 2px;
  display: block;
}
.box1-chart {
  width: 100%;
  height: 176px;
}
/* ── box2：同供应商已看商品数 ── */
.box2-card {
  height: 24px;
  padding: 2px 8px;
}
.box2-stat svg {
  opacity: 0.6;
}
</style>
