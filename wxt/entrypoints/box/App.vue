<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// box1 图表按需引入（减小打包体积）
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps(['parentEl', 'offerId', 'batchCache', 'chartType'])

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

// ── box1 双折线图：最近 14 天 出现次数 / 浏览次数（X=日期，Y=次数）──
// 两个计数任一有记录就显示
const hasChartData = computed(() => {
  const t = info.value?.my_views_timeline
  return !!t && t.some(x => x.appear > 0 || x.view > 0)
})
const chartEl = ref(null)
let chartInstance = null

function renderChart() {
  const timeline = info.value?.my_views_timeline
  // 没有任何数据的商品不渲染图表（避免空图表区）
  if (!chartEl.value || !timeline || !timeline.some(t => t.appear > 0 || t.view > 0)) {
    if (chartInstance) { chartInstance.dispose(); chartInstance = null }
    return
  }
  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value)
  }
  const isLine = props.chartType !== 'bar'
  const common = { smooth: true, symbolSize: 4, barMaxWidth: 8 }
  chartInstance.setOption({
    grid: { left: 26, right: 6, top: 22, bottom: 18 },
    legend: {
      top: 0, right: 0, itemWidth: 10, itemHeight: 8,
      textStyle: { fontSize: 8, color: '#9ca3af' },
      data: ['出现', '浏览']
    },
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: 11 },
      formatter: ps => `${ps[0].axisValue}<br/>${ps.map(p => `${p.seriesName} ${p.value} 次`).join('<br/>')}`
    },
    xAxis: {
      type: 'category',
      data: timeline.map(t => t.date),
      axisLabel: { fontSize: 8, interval: 3, color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 8, color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [
      {
        name: '出现',
        type: isLine ? 'line' : 'bar',
        data: timeline.map(t => t.appear),
        color: '#8faedd',
        ...common,
        lineStyle: { width: 2, color: '#8faedd' },
        itemStyle: { color: '#8faedd', ...(isLine ? {} : { borderRadius: [3, 3, 0, 0] }) },
        areaStyle: isLine ? { opacity: 0.15 } : undefined,
      },
      {
        name: '浏览',
        type: isLine ? 'line' : 'bar',
        data: timeline.map(t => t.view),
        color: '#c9975c',
        ...common,
        lineStyle: { width: 2, color: '#c9975c' },
        itemStyle: { color: '#c9975c' },
      }
    ]
  }, true)
}

onMounted(() => nextTick(renderChart))
onUnmounted(() => { chartInstance?.dispose(); chartInstance = null })
watch(() => info.value?.my_views_timeline, () => nextTick(renderChart))
watch(() => props.chartType, () => nextTick(renderChart))
watch(hasChartData, (v) => { if (v) nextTick(renderChart) })

// 小圆点颜色：绿色=看过，灰色=没看过
const dotColor = computed(() => (iHaveViewed.value ? '#52c41a' : '#d9d9d9'))
</script>

<template>
  <template v-if="offer_id">
    <div class="box-card">
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
      </div>
    </div>

    <!-- box1：双折线图（最近 14 天 出现/浏览），有记录才出现 -->
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
/* ── box1：双折线图 ── */
.box1-card {
  height: auto;
  padding: 4px 8px 2px;
  display: block;
}
.box1-chart {
  width: 100%;
  height: 96px;
  margin-top: 2px;
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
