<!-- HsCalendarHeatmap.vue — GitHub 式按天浏览热力图（echarts calendar + heatmap 按需引入）
     props: daily [{date:'YYYY-MM-DD', count, dwell}]，height px
     固定 cellSize 13 = 正方形小方格，近 150 天窗口，格子越绿当天停留越久
     点格子 emit('pick', date) —— 当日明细由父组件用自己的流水渲染 -->
<template>
  <div ref="chartEl" class="hs-cal" :style="{ height: height + 'px' }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { CalendarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([HeatmapChart, CalendarComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const props = defineProps({
  daily: { type: Array, default: () => [] },  // [{date:'YYYY-MM-DD', count, dwell}]
  height: { type: Number, default: 132 },
  days: { type: Number, default: 150 },       // 热力图窗口天数（22 周 ≈ 铺满 340px 宽面板）
})
const emit = defineEmits(['pick'])

const chartEl = ref(null)
let chart = null
let ro = null

function fmtSec(s) {
  if (s <= 0) return ''
  if (s < 60) return s + '秒'
  const m = Math.floor(s / 60)
  if (m < 60) return m + '分' + (s % 60 ? (s % 60) + '秒' : '')
  return Math.floor(m / 60) + '小时' + (m % 60 ? m % 60 + '分' : '')
}

function render() {
  if (!chartEl.value) return
  if (chartEl.value.offsetWidth < 10) return
  if (!chart) {
    chart = echarts.init(chartEl.value)
    chart.on('click', p => {
      if (p.componentType === 'series') emit('pick', p.value[0])
    })
  }
  const data = (props.daily || [])
    .filter(d => d.count > 0)
    .map(d => [d.date, d.dwell, d.count])
  const maxDwell = Math.max(60, ...data.map(d => d[1]))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const p = n => String(n).padStart(2, '0')
  const dstr = d => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  const start = new Date(today.getTime() - (props.days - 1) * 86400000)

  chart.setOption({
    visualMap: {
      min: 0, max: maxDwell, show: false,
      inRange: { color: ['#e8eee9', '#a9cfb6', '#6ea985', '#3e6b52'] },
    },
    calendar: {
      top: 20, left: 'center', cellSize: 13,
      range: [dstr(start), dstr(today)],
      itemStyle: { color: '#fafafa', borderColor: '#fff', borderWidth: 2 },
      splitLine: { show: false },
      dayLabel: { firstDay: 1, nameMap: ['日', '一', '二', '三', '四', '五', '六'], fontSize: 9, color: '#bbb' },
      monthLabel: { nameMap: 'cn', fontSize: 10, color: '#999' },
      yearLabel: { show: false },
    },
    series: [{
      type: 'heatmap', coordinateSystem: 'calendar', data,
      itemStyle: { borderRadius: 3 },
    }],
    tooltip: {
      formatter: pt => {
        const [date, dwell, count] = pt.value
        return `${date.slice(5)} · 浏览 ${count} 次${dwell > 0 ? ` · 停留 ${fmtSec(dwell)}` : ''}`
      },
    },
  }, { notMerge: true })
  chart.resize()
}

onMounted(async () => {
  await nextTick()
  ro = new ResizeObserver(() => {
    if (!chartEl.value || chartEl.value.offsetWidth < 10) return
    requestAnimationFrame(render)
  })
  ro.observe(chartEl.value)
  render()
})
onBeforeUnmount(() => {
  try { ro && ro.disconnect() } catch {}
  try { chart && chart.dispose() } catch {}
})
</script>

<style scoped>
.hs-cal { width: 100%; }
</style>
