<!-- HsHeatmap.vue — 共享的星期×小时浏览热力图（echarts heatmap 按需引入）
     props: heatmap 7×24 矩阵（0=周一 … 6=周日），height px -->
<template>
  <div ref="chartEl" class="hs-heatmap" :style="{ height: height + 'px' }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const props = defineProps({
  heatmap: { type: Array, default: () => [] },  // 7×24
  height: { type: Number, default: 170 },
})
const chartEl = ref(null)
let chart = null
let ro = null
const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function render() {
  if (!chartEl.value) return
  if (chartEl.value.offsetWidth < 10) return
  if (!chart) chart = echarts.init(chartEl.value)
  const hm = props.heatmap || []
  const data = []
  let maxV = 0
  hm.forEach((row, wd) => {
    ;(row || []).forEach((v, h) => {
      data.push([h, wd, v])
      if (v > maxV) maxV = v
    })
  })
  chart.setOption({
    grid: { left: 40, right: 10, top: 6, bottom: 20 },
    tooltip: {
      formatter: (p) => `${WEEK[p.value[1]]} ${p.value[0]}时 · 浏览 ${p.value[2]} 次`,
    },
    xAxis: {
      type: 'category', data: Array.from({ length: 24 }, (_, i) => i),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#999', fontSize: 9, interval: 2 },
    },
    yAxis: {
      type: 'category', data: WEEK,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#999', fontSize: 9 },
    },
    visualMap: {
      min: 0, max: Math.max(1, maxV), calculable: false,
      orient: 'horizontal', left: 'center', bottom: -4,
      itemWidth: 10, itemHeight: 60, show: false,
      inRange: { color: ['#fff7ee', '#ffd8ad', '#ff9d4d', '#ff5b00'] },
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: false },
      itemStyle: { borderWidth: 1, borderColor: '#fff', borderRadius: 2 },
    }],
  })
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
.hs-heatmap { width: 100%; }
</style>
