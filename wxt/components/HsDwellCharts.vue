<!-- HsDwellCharts.vue — 共享的商品浏览时长多图表（echarts 按需引入）
     同一份时长排行数据（[{offer_id, title, dwell, views}]，已按 dwell 降序）内建切换：
     条形 / 柱状 / 饼图 / 玫瑰，≥3 个商品时追加雷达。选择存 localStorage 记忆。
     悬浮看完整标题/浏览次数/停留时长，点击（雷达除外）触发 pick 跳商品。IM 面板与管理后台共用 -->
<template>
  <div class="hs-dwell-charts">
    <div class="hdc-switch">
      <button v-for="t in types" :key="t.key" class="hdc-opt" :class="{ active: type === t.key }" @click="setType(t.key)">{{ t.label }}</button>
    </div>
    <div ref="chartEl" class="hdc-chart" :style="{ height: chartHeight + 'px' }"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, PieChart, RadarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, PieChart, RadarChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  list: { type: Array, default: () => [] },   // [{offer_id, title, dwell, views}]
  height: { type: Number, default: 120 },     // 条形/柱状图高度；饼图/玫瑰/雷达取 max(height, 220)
})
const emit = defineEmits(['pick'])
const chartEl = ref(null)
let chart = null
let ro = null
const MAX_BARS = 15
const STORE_KEY = 'alocsDwellChartType'
const BASE_TYPES = [
  { key: 'bar', label: '条形' },
  { key: 'column', label: '柱状' },
  { key: 'pie', label: '饼图' },
  { key: 'rose', label: '玫瑰' },
]
// 暖色系主调，掺入趋势图已有的蓝/绿，切片多时也能区分
const PALETTE = ['#ff5b00', '#ff9d4d', '#ffc069', '#ffd8ad', '#c9975c', '#4a90d9', '#8fbf9f', '#e6a23c', '#d48265', '#ffb26b', '#b9986f', '#7ba7d4', '#a8d4b0', '#f0c987', '#e8987f']

const type = ref('bar')
try { type.value = localStorage.getItem(STORE_KEY) || 'bar' } catch {}

const rows = computed(() => (props.list || []).slice(0, MAX_BARS))
const types = computed(() => rows.value.length >= 3 ? [...BASE_TYPES, { key: 'radar', label: '雷达' }] : BASE_TYPES)
const chartHeight = computed(() => type.value === 'column' ? Math.max(props.height, 110) : (type.value === 'bar' ? props.height : Math.max(props.height, 220)))

function setType(t) {
  type.value = t
  try { localStorage.setItem(STORE_KEY, t) } catch {}
}

const pad = (n) => String(n).padStart(2, '0')
function fmtDwell(s) {
  if (!s || s <= 0) return ''
  if (s < 60) return s + '秒'
  return Math.floor(s / 60) + '分' + (s % 60 ? (s % 60) + '秒' : '')
}
function short(text, n = 12) {
  const t = String(text || '')
  return t.length > n ? t.slice(0, n) + '…' : t
}
function dwellTip(m) {
  return `${m.title || m.offer_id}<br/>停留 ${fmtDwell(m.dwell)} · 浏览 ${m.views || 0} 次`
}

function render() {
  if (!chartEl.value) return
  // 容器隐藏（宽度为 0）时跳过渲染，等可见（ResizeObserver 触发）后按真实尺寸重绘
  if (chartEl.value.offsetWidth < 10) return
  if (!chart) chart = echarts.init(chartEl.value)
  if (type.value === 'radar' && rows.value.length < 3) type.value = 'bar' // 数据变少时雷达降级
  const data = rows.value
  const opt = { tooltip: { trigger: 'item', confine: true } }
  if (type.value === 'bar') {
    opt.grid = { left: 8, right: 46, top: 6, bottom: 18, containLabels: true }
    opt.xAxis = { type: 'value', axisLabel: { fontSize: 9, color: '#999', formatter: (v) => fmtDwell(v) }, splitLine: { lineStyle: { color: '#f5f5f5' } } }
    opt.yAxis = { type: 'category', inverse: true, data: data.map(r => r.title || r.offer_id), axisLabel: { fontSize: 10, color: '#555', formatter: (v) => short(v) }, axisLine: { show: false }, axisTick: { show: false } }
    opt.series = [{
      type: 'bar', barWidth: 10,
      data: data.map(r => ({ value: r.dwell || 0, meta: r, itemStyle: { color: '#ff9d4d' } })),
      itemStyle: { borderRadius: [0, 5, 5, 0] },
      emphasis: { itemStyle: { color: '#ff5b00' } },
      label: { show: true, position: 'right', fontSize: 9, color: '#b9986f', formatter: (p) => fmtDwell(p.value) },
      cursor: 'pointer',
    }]
    opt.tooltip.formatter = (p) => dwellTip((p.data && p.data.meta) || {})
  } else if (type.value === 'column') {
    opt.grid = { left: 8, right: 8, top: 22, bottom: 4, containLabels: true }
    opt.xAxis = { type: 'category', data: data.map(r => r.title || r.offer_id), axisLabel: { fontSize: 9, color: '#666', interval: 0, rotate: 28, formatter: (v) => short(v, 7) }, axisLine: { lineStyle: { color: '#e5e5e5' } }, axisTick: { show: false } }
    opt.yAxis = { type: 'value', splitNumber: 3, minInterval: 1, axisLabel: { fontSize: 9, color: '#999', formatter: (v) => fmtDwell(v) }, splitLine: { lineStyle: { color: '#f5f5f5' } } }
    opt.series = [{
      type: 'bar', barMaxWidth: 26,
      data: data.map(r => ({ value: r.dwell || 0, meta: r, itemStyle: { color: '#ff9d4d' } })),
      itemStyle: { borderRadius: [5, 5, 0, 0] },
      emphasis: { itemStyle: { color: '#ff5b00' } },
      label: { show: true, position: 'top', fontSize: 9, color: '#b9986f', formatter: (p) => fmtDwell(p.value) },
      cursor: 'pointer',
    }]
    opt.tooltip.formatter = (p) => dwellTip((p.data && p.data.meta) || {})
  } else if (type.value === 'pie' || type.value === 'rose') {
    opt.color = PALETTE
    opt.series = [{
      type: 'pie',
      roseType: type.value === 'rose' ? 'radius' : undefined,
      radius: type.value === 'rose' ? ['12%', '72%'] : '62%',
      center: ['50%', '48%'],
      minAngle: 3,
      data: data.map(r => ({ name: r.title || r.offer_id, value: r.dwell || 0, meta: r })),
      label: { fontSize: 9, color: '#888', formatter: (p) => p.percent >= 8 ? `${p.percent}%` : '' },
      labelLine: { length: 6, length2: 4, lineStyle: { color: '#ddd' } },
      emphasis: { scaleSize: 4 },
      cursor: 'pointer',
    }]
    opt.tooltip.formatter = (p) => `${dwellTip(p.data.meta || {})}<br/>占比 ${p.percent}%`
  } else if (type.value === 'radar') {
    const rs = data.slice(0, 8)
    opt.radar = {
      indicator: rs.map(r => ({ name: short(r.title || r.offer_id, 8), max: Math.max(1, rs[0].dwell) * 1.05 })),
      radius: '62%', center: ['50%', '50%'],
      axisName: { fontSize: 9, color: '#888' },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: '#eee' } },
    }
    opt.series = [{
      type: 'radar',
      data: [{
        value: rs.map(r => r.dwell || 0),
        name: '停留时长',
        meta: rs,
        lineStyle: { color: '#ff9d4d', width: 1.5 },
        itemStyle: { color: '#ff5b00' },
        areaStyle: { color: 'rgba(255,157,77,0.18)' },
        symbolSize: 4,
      }],
    }]
    opt.tooltip.formatter = () => `停留合计 ${fmtDwell(data.reduce((s, r) => s + (r.dwell || 0), 0))} · 商品 ${data.length} 个`
  }
  chart.setOption(opt, { notMerge: true })
  chart.resize()
  chart.off('click')
  chart.on('click', (p) => {
    const m = p.data && p.data.meta
    if (m && m.offer_id) emit('pick', { offer_id: m.offer_id, title: m.title })
  })
}

onMounted(async () => {
  await nextTick()
  // 容器尺寸变化（含 v-show 隐藏→可见、抽屉动画、切换图表类型改高度）时按真实尺寸重绘
  ro = new ResizeObserver(() => {
    if (!chartEl.value || chartEl.value.offsetWidth < 10) return
    requestAnimationFrame(render)
  })
  ro.observe(chartEl.value)
  render()
})
watch(() => props.list, render, { deep: true })
watch(type, render)
onBeforeUnmount(() => {
  try { ro && ro.disconnect() } catch {}
  try { chart && chart.dispose() } catch {}
})
</script>

<style scoped>
.hs-dwell-charts { width: 100%; }
.hdc-switch {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 4px;
}
.hdc-opt {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 9px;
  border: 1px solid #eee;
  background: #fff;
  color: #999;
  cursor: pointer;
  line-height: 1.5;
}
.hdc-opt:hover { color: #ff5b00; }
.hdc-opt.active {
  color: #ff5b00;
  background: #fff3e9;
  border-color: #ffbf8e;
}
.hdc-chart { width: 100%; }
</style>
