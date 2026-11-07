<!-- HsTrendChart.vue — 共享的近 N 天出现/浏览趋势图（echarts 按需引入）
     props: daily [{date, view, appear}]，height px。供 IM 面板与管理后台共用 -->
<template>
  <div ref="chartEl" class="hs-trend-chart" :style="{ height: height + 'px' }"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  daily: { type: Array, default: () => [] },   // [{date, view, appear}]
  height: { type: Number, default: 160 },
})
const chartEl = ref(null)
let chart = null

function render() {
  if (!chartEl.value) return
  if (!chart) chart = echarts.init(chartEl.value)
  const daily = props.daily || []
  chart.setOption({
    grid: { left: 30, right: 10, top: 26, bottom: 20 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, left: 'center', itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 10, color: '#888' } },
    xAxis: {
      type: 'category',
      data: daily.map(d => d.date),
      axisLabel: { fontSize: 9, color: '#999', interval: Math.max(0, Math.floor(daily.length / 6)) },
      axisLine: { lineStyle: { color: '#e5e5e5' } },
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 9, color: '#999' }, splitLine: { lineStyle: { color: '#f5f5f5' } } },
    series: [
      {
        name: '出现', type: 'line', smooth: true, symbol: 'none',
        data: daily.map(d => d.appear || 0),
        lineStyle: { color: '#4a90d9', width: 1.5 }, itemStyle: { color: '#4a90d9' },
        areaStyle: { color: 'rgba(74,144,217,0.08)' },
      },
      {
        name: '浏览', type: 'line', smooth: true, symbol: 'none',
        data: daily.map(d => d.view || 0),
        lineStyle: { color: '#c9975c', width: 1.5 }, itemStyle: { color: '#c9975c' },
        areaStyle: { color: 'rgba(201,151,92,0.10)' },
      },
    ],
  })
  chart.resize()
}

onMounted(async () => {
  await nextTick()
  render()
})
watch(() => props.daily, render, { deep: true })
onBeforeUnmount(() => { try { chart && chart.dispose() } catch {} })
</script>

<style scoped>
.hs-trend-chart { width: 100%; }
</style>
