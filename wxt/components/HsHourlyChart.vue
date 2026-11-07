<!-- HsHourlyChart.vue — 共享的 24 小时浏览时段分布柱状图（echarts 按需引入） -->
<template>
  <div ref="chartEl" class="hs-hourly-chart" :style="{ height: height + 'px' }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  hourly: { type: Array, default: () => [] },  // 24 个数字
  height: { type: Number, default: 130 },
})
const chartEl = ref(null)
let chart = null

function render() {
  if (!chartEl.value) return
  if (!chart) chart = echarts.init(chartEl.value)
  const data = props.hourly || []
  chart.setOption({
    grid: { left: 28, right: 10, top: 14, bottom: 20 },
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}时 · 浏览 ${p[0].value} 次` },
    xAxis: {
      type: 'category',
      data: data.map((_, i) => i),
      axisLine: { lineStyle: { color: '#eee' } },
      axisLabel: { color: '#999', fontSize: 9, interval: 2 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', minInterval: 1,
      axisLabel: { color: '#999', fontSize: 9 },
      splitLine: { lineStyle: { color: '#f5f5f5' } },
    },
    series: [{
      type: 'bar', data, barWidth: '60%',
      itemStyle: { color: '#1677ff', borderRadius: [2, 2, 0, 0] },
    }],
  })
  chart.resize()
}

onMounted(async () => {
  await nextTick()
  render()
})
onBeforeUnmount(() => { try { chart && chart.dispose() } catch {} })
</script>

<style scoped>
.hs-hourly-chart { width: 100%; }
</style>
