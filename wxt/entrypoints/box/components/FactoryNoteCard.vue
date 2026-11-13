<script setup>
// FactoryNoteCard.vue — 找工厂页：卡片右侧备注列（UI 定稿见 docs/找工厂页-交接文档.md）
// 结构：textarea 直接编辑自动保存 → ECharts 浏览趋势折线图（30 天）→ 底部统计行
// 数据来自父组件传入的响应式 note（localapi /suppliers/batch_info）
// 复用 comments 表 kind='supplier'，兼容旧版库；不显示他人备注
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import CommentInput from '../../win/components/CommentInput.vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps(['factoryName', 'memberId', 'offerId', 'note', 'reload'])

// 备注改用与 win「供应商笔记」同款富文本编辑器（CommentInput），自带加载/自动保存
const viewedCount = computed(() => props.note?.viewed_product_count ?? 0)
const commentCount = computed(() => props.note?.comment_count ?? 0)
const chatCount = computed(() => props.note?.chat_count ?? 0)

// 富文本保存成功后刷新该工厂统计（评论数等）
function onSaved() { props.reload?.() }

// ── 折线图：该供应商名下商品近 30 天浏览流水按日聚合 ──
const chartEl = ref(null)
let chartInstance = null

const timeline = computed(() => props.note?.views_timeline || [])
const viewTotal = computed(() => timeline.value.reduce((s, t) => s + (t.count || 0), 0))

function renderChart() {
  if (!chartEl.value) return
  // 容器宽度未就绪（卡片 flex 布局完成前）→ 等一帧再试，避免 echarts 以宽 0 初始化
  if (chartEl.value.clientWidth === 0) {
    requestAnimationFrame(() => nextTick(renderChart))
    return
  }
  const data = timeline.value
  console.log('[factory-chart]', props.factoryName, '桶数:', data.length, '总浏览:', viewTotal.value)
  if (!chartInstance) chartInstance = echarts.init(chartEl.value)
  if (data.length === 0) { chartInstance.clear(); return }
  const dates = data.map(t => t.date)
  // 日期刻度稀疏化：约 4 个刻度点（对齐 box1 底部日期轴）
  const labelInterval = Math.max(0, Math.floor(data.length / 4) - 1)
  chartInstance.setOption({
    // 参考 box1：留左边距放 y 轴刻度、底边距放日期标签；y 轴 min 0，max 至少 1（全 0 也有贴底线）
    grid: { left: 20, right: 6, top: 6, bottom: 14 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#c0c4cc', type: 'dashed' } },
      formatter: ps => {
        const t = data[ps[0].dataIndex]
        return `${t.date}<br/>浏览 ${t.count} 次`
      },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e5e5',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 11 },
      extraCssText: 'box-shadow:0 4px 12px rgba(0,0,0,0.1);border-radius:6px;',
    },
    xAxis: {
      type: 'category', data: dates,
      axisLabel: { fontSize: 8, interval: labelInterval, color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', minInterval: 1,
      max: v => Math.max(1, v.max),
      axisLabel: { fontSize: 8, color: '#b0b7c3' },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: [{
      type: 'line',
      data: data.map(t => t.count),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1.5, color: '#8faedd' },
      itemStyle: { color: '#8faedd' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(143,174,221,0.32)' },
          { offset: 1, color: 'rgba(143,174,221,0.02)' },
        ]),
      },
      animationDuration: 600,
    }],
  }, true)
}

function onWinResize() { chartInstance?.resize() }

onMounted(() => {
  nextTick(renderChart)
  window.addEventListener('resize', onWinResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onWinResize)
  chartInstance?.dispose(); chartInstance = null
})
watch(() => props.note?.views_timeline, () => nextTick(renderChart))
</script>

<template>
  <!-- 右侧备注组：左边备注（富文本），右边浏览趋势折线图 + 统计。防跳转由主世界 box-scan 守卫负责 -->
  <div class="fn-col">
    <div class="fn-main">
      <div class="fn-editor">
        <CommentInput kind="supplier" :target="factoryName" :memberId="memberId" :repOfferId="offerId" placeholder="备注这家工厂..." :showToolbar="false" @saved="onSaved" />
      </div>
    </div>

    <div class="fn-side">
      <!-- 图表块始终渲染：标题先出来，便于区分“数据未到”还是“渲染失败” -->
      <div class="fn-chart">
        <div class="fn-chart-title">
          <span class="t">浏览趋势</span>
          <span class="v">近30天 {{ viewTotal }} 次</span>
        </div>
        <div ref="chartEl" class="fn-chart-box"></div>
      </div>

      <div class="fn-stats">
        <span class="st">评论 <b>{{ commentCount }}</b> · 已看 <b>{{ viewedCount }}</b></span>
        <span class="st">聊天 <b>{{ chatCount }}</b> 条</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 右侧备注组：内部再分左右两块（备注 | 折线图+统计），宽度由父级卡片 flex 控制 */
.fn-col {
  box-sizing: border-box;
  flex: 1 1 auto;
  width: 100%;
  align-self: stretch;
  display: flex;
  flex-direction: row;
  gap: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif;
  font-size: 12px;
  color: #666;
  background: #fff;
}
.fn-main { flex: 1 1 auto; min-width: 0; display: flex; }
.fn-editor {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  transition: border-color .2s;
}
.fn-editor:focus-within { border-color: #c9975c; }
/* 压缩 win 富文本组件以适配卡片里的窄列 */
.fn-editor :deep(.rich-editor-wrap) { flex: 1; min-height: 0; }
.fn-editor :deep(.editor-header) { padding: 2px 6px; gap: 4px; }
.fn-editor :deep(.editor-container) { min-height: 40px !important; }
.fn-editor :deep(.w-e-text-container) { min-height: 40px !important; border: none !important; }
.fn-editor :deep(.w-e-toolbar) { border: none !important; border-bottom: 1px solid #f2f2f2 !important; }
.fn-editor :deep(.w-e-text-container [data-slate-editor]) { min-height: 40px !important; padding: 4px 8px !important; font-size: 12px !important; line-height: 1.5 !important; }
.fn-editor :deep(.w-e-text-placeholder) { top: 4px !important; left: 8px !important; font-size: 12px !important; }

/* 右小列：折线图 + 统计 */
.fn-side {
  flex: 0 0 150px;
  width: 150px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fn-chart { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fn-chart-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
  margin-bottom: 2px;
}
.fn-chart-title .t { color: #999; font-size: 10px; font-weight: 500; }
.fn-chart-title .v { color: #c9975c; font-weight: 600; font-size: 10px; }
.fn-chart-box { width: 100%; flex: 1 1 auto; height: auto; min-height: 38px; }
.fn-stats {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex-shrink: 0;
  padding-top: 3px;
  border-top: 1px solid #f0e6d6;
}
.fn-stats .st { font-size: 9px; color: #999; line-height: 1.35; white-space: nowrap; }
.fn-stats .st b { color: #c9975c; font-weight: 600; font-size: 10px; }
</style>
