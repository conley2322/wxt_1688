<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getProfile } from '../../utils/localdb.js'

// box1 图表按需引入（减小打包体积）
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer])

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

const viewCount = computed(() => info.value?.view_count ?? 0)
const iHaveViewed = computed(() => info.value?.i_have_viewed ?? false)

// ── 我的资料（昵称 + 头像色，通用头像可改）──
const profile = ref({ nickname: '我', avatar_color: '#8a8f99' })
onMounted(async () => {
  profile.value = await getProfile()
})

// ── 上次浏览时间 ──
function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) return `今天 ${hm}`
  const sameYear = d.getFullYear() === now.getFullYear()
  if (sameYear) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}
const lastViewedAtText = computed(() => {
  const ts = info.value?.last_viewed_at
  return ts ? formatTime(ts) : ''
})

// ── box1 图表：我最近 14 天的浏览记录（X=日期，Y=次数）──
const chartEl = ref(null)
let chartInstance = null

function renderChart() {
  const timeline = info.value?.my_views_timeline
  if (!chartEl.value || !timeline) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value)
  }
  const isLine = props.chartType !== 'bar'
  chartInstance.setOption({
    grid: { left: 26, right: 6, top: 12, bottom: 18 },
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: 11 },
      formatter: p => `${p[0].axisValue}：浏览 ${p[0].value} 次`
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
    series: [{
      type: isLine ? 'line' : 'bar',
      data: timeline.map(t => t.count),
      smooth: true,
      symbolSize: 4,
      lineStyle: { width: 2, color: '#c9975c' },
      itemStyle: { color: '#c9975c', ...(isLine ? {} : { borderRadius: [3, 3, 0, 0] }) },
      areaStyle: isLine ? { opacity: 0.18 } : undefined,
      barMaxWidth: 10,
    }]
  }, true)
}

onMounted(() => nextTick(renderChart))
onUnmounted(() => { chartInstance?.dispose(); chartInstance = null })
watch(() => info.value?.my_views_timeline, () => nextTick(renderChart))
watch(() => props.chartType, () => nextTick(renderChart))

// 小圆点颜色：绿色=看过，灰色=没看过
const dotColor = computed(() => (iHaveViewed.value ? '#52c41a' : '#d9d9d9'))
</script>

<template>
  <template v-if="offer_id">
    <div class="box-card">
      <div class="box-row">
        <!-- 小圆点 -->
        <span class="box-dot" :style="{ background: dotColor }"></span>

        <!-- 浏览数（单机版：仅自己的浏览记录） -->
        <span class="box-stat" title="我浏览过的次数">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          {{ viewCount }}
        </span>
      </div>
    </div>

    <!-- box1：我的浏览统计 + 最近 14 天浏览时间折线图 -->
    <div class="box-card box1-card">
      <div class="box-row">
        <span class="box-stat box1-stat" title="我浏览该商品的次数">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          浏览 {{ viewCount }} 次
        </span>
        <span class="avatar-stack box1-avatars" :title="profile.nickname">
          <span class="avatar-dot" :style="{ background: profile.avatar_color }">{{ profile.nickname.charAt(0) }}</span>
        </span>
        <span v-if="lastViewedAtText" class="box1-time" :title="'上次浏览时间：' + (info?.last_viewed_at ? new Date(info.last_viewed_at).toLocaleString('zh-CN', { hour12: false }) : '')">{{ lastViewedAtText }}</span>
      </div>
      <div ref="chartEl" class="box1-chart"></div>
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
  gap: 6px;
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
/* ── box1：浏览统计 + 图表 ── */
.box1-card {
  height: auto;
  padding: 6px 8px 2px;
  display: block;
}
.box1-chart {
  width: 100%;
  height: 96px;
  margin-top: 2px;
}
.box1-stat {
  color: #c9975c;
  font-weight: 600;
}
.box1-stat svg {
  opacity: 0.9;
}
.box1-time {
  margin-left: auto;
  font-size: 10px;
  color: #bbb;
  white-space: nowrap;
}
.box1-avatars {
  margin-left: 2px;
}
/* ── 头像栈 ── */
.avatar-stack { display: flex; align-items: center; flex-shrink: 0; }
.avatar-dot {
  width: 16px; height: 16px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 600; color: #fff;
  border: 1.5px solid #f5f6f8; flex-shrink: 0;
}
</style>
