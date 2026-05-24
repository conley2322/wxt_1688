<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import { useApiStore } from '@/entrypoints/stores/api/api.js'

const store = useApiStore()
const chartRef = ref(null)
let chartInstance = null

const chartData = computed(() => {
  return store.viewerStatsWithPercent.map(v => ({
    name: v.name,
    value: v.count,
    percent: v.percentage,
  }))
})

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

function updateChart() {
  if (!chartInstance) return
  const data = chartData.value
  chartInstance.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}次 ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11,
          color: '#666',
        },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold' },
        },
        data: data.map(v => ({
          name: v.name,
          value: v.value,
        })),
      },
    ],
  })
}

const totalViewCount = computed(() =>
  store.viewerStats.reduce((s, v) => s + v.count, 0)
)

onMounted(initChart)
onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<template>
  <div class="analysis-views">
    <div ref="chartRef" class="chart-container"></div>
    <div class="stats-summary">
      <span>总浏览次数: {{ totalViewCount }}</span>
      <span>总浏览人数: {{ store.viewerStats.length }}</span>
    </div>
    <div class="viewer-list">
      <div v-for="(v, i) in store.viewerStats" :key="v.name" class="viewer-row">
        <span class="viewer-rank">{{ ['🥇', '🥈', '🥉', '4️⃣'][i] || '' }}</span>
        <span class="viewer-name">{{ v.name }}</span>
        <span class="viewer-count">{{ v.count }}次</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-views {
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.chart-container {
  width: 240px;
  height: 240px;
}
.stats-summary {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
  margin: 8px 0;
}
.viewer-list {
  width: 100%;
}
.viewer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
}
.viewer-row + .viewer-row {
  border-top: 1px solid #f5f5f5;
}
.viewer-rank {
  font-size: 14px;
}
.viewer-name {
  flex: 1;
  color: #333;
  font-weight: 500;
}
.viewer-count {
  color: #999;
}
</style>