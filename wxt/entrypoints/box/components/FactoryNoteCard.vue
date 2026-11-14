<script setup>
// FactoryNoteCard.vue — 找工厂页：卡片右侧备注列（UI 定稿见 docs/找工厂页-交接文档.md + docs/找工厂页-卡片UI-mock.html）
// 结构（定稿 mock v3）：
//   顶行：统计单行（左）+ 页签胶囊 备注｜趋势（右，hover 即切，默认页签由设置 factoryCardDefaultTab 决定）
//   内容区铺满剩余高度、底部零留白：
//     备注 tab = 只读边框盒（渲染已存富文本，4 行截断）+ 全屏按钮 —— 非全屏不可编辑
//     趋势 tab = ECharts 三线折线图（浏览次数 / 聊天条数 / 商品数量·每天新看款数，近 30 天）
//   全屏 = 富文本编辑器（CommentInput 完整工具栏），只有全屏可编辑，保存/关闭后刷新统计与内联渲染
// 数据来自父组件传入的响应式 note（localapi /suppliers/batch_info）
// 复用 comments 表 kind='supplier'，与详情页「供应商」页签同一条数据；不显示他人备注
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import CommentInput from '../../win/components/CommentInput.vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps(['factoryName', 'memberId', 'offerId', 'note', 'reload', 'defaultTab'])

// 默认页签：设置「找工厂卡片默认页签」（note=备注 / trend=趋势），由 box-content 传入
const tab = ref(props.defaultTab === 'trend' ? 'trend' : 'note')

// ── 统计（单行，顶行左侧）──
const viewedCount = computed(() => props.note?.viewed_product_count ?? 0)
const viewCount = computed(() => props.note?.view_count ?? 0)
const commentCount = computed(() => props.note?.comment_count ?? 0)
const chatCount = computed(() => props.note?.chat_count ?? 0)
const chatDays = computed(() => props.note?.chat_days ?? 0)

// ── 备注：非全屏只渲染已存富文本 ──
const noteText = computed(() => props.note?.my_comments?.[0]?.text || '')

// 富文本保存成功后刷新该工厂统计（评论数、内联渲染的文字）
function onSaved() { props.reload?.() }

// ── 全屏编辑：整屏白底覆盖层，内嵌完整 CommentInput（工具栏+保存），只有这里可编辑 ──
const fullscreen = ref(false)
function closeFullscreen() {
  fullscreen.value = false
  props.reload?.() // 自动保存的内容落库后同步内联渲染与统计
}

// ── 折线图：浏览 / 聊天 / 商品数量 三条线，近 30 天按日聚合 ──
const chartEl = ref(null)
let chartInstance = null

const viewTimeline = computed(() => props.note?.views_timeline || [])
const chatTimeline = computed(() => props.note?.chat_timeline || [])
const prodTimeline = computed(() => props.note?.product_timeline || [])
const viewTotal = computed(() => viewTimeline.value.reduce((s, t) => s + (t.count || 0), 0))
const chatTotal = computed(() => chatTimeline.value.reduce((s, t) => s + (t.count || 0), 0))
const prodTotal = computed(() => prodTimeline.value.reduce((s, t) => s + (t.count || 0), 0))

function renderChart() {
  if (!chartEl.value || tab.value !== 'trend') return
  // 容器宽度未就绪（页签刚显示、卡片 flex 布局完成前）→ 等一帧再试，避免 echarts 以宽 0 初始化
  if (chartEl.value.clientWidth === 0) {
    requestAnimationFrame(() => nextTick(renderChart))
    return
  }
  const data = viewTimeline.value.map((t, i) => ({
    date: t.date,
    view: t.count || 0,
    chat: chatTimeline.value[i]?.count || 0,
    prod: prodTimeline.value[i]?.count || 0,
  }))
  if (!chartInstance) chartInstance = echarts.init(chartEl.value)
  if (data.length === 0) { chartInstance.clear(); return }
  const labelInterval = Math.max(0, Math.floor(data.length / 4) - 1)
  const line = (name, color, key, areaA, areaB) => ({
    name, type: 'line', data: data.map(t => t[key]),
    smooth: true, symbol: 'none',
    lineStyle: { width: 1.4, color }, itemStyle: { color },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: areaA }, { offset: 1, color: areaB },
      ]),
    },
    animationDuration: 600,
  })
  chartInstance.setOption({
    // y 轴 min 0，max 至少 1（全 0 也有贴底线）
    grid: { left: 20, right: 6, top: 8, bottom: 14 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#c0c4cc', type: 'dashed' } },
      formatter: ps => {
        const t = data[ps[0].dataIndex]
        return `${t.date}<br/>浏览 ${t.view} 次<br/>聊天 ${t.chat} 条<br/>新看 ${t.prod} 款`
      },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e5e5',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 11 },
      extraCssText: 'box-shadow:0 4px 12px rgba(0,0,0,0.1);border-radius:6px;',
    },
    xAxis: {
      type: 'category', data: data.map(t => t.date),
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
    series: [
      line('浏览', '#8faedd', 'view', 'rgba(143,174,221,0.30)', 'rgba(143,174,221,0.02)'),
      line('聊天', '#c9975c', 'chat', 'rgba(201,151,92,0.24)', 'rgba(201,151,92,0.02)'),
      line('商品', '#8fbf9f', 'prod', 'rgba(143,191,159,0.20)', 'rgba(143,191,159,0.02)'),
    ],
  }, true)
}

function onWinResize() { chartInstance?.resize() }

onMounted(() => {
  window.addEventListener('resize', onWinResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onWinResize)
  chartInstance?.dispose(); chartInstance = null
})
// 切到趋势页签或数据到达时渲染（v-show 展开后容器才有宽度）
watch([tab, viewTimeline, chatTimeline, prodTimeline], () => nextTick(renderChart))
</script>

<template>
  <!-- 右侧备注组：顶行（统计+页签）→ 内容区铺满、底部零留白。防跳转由主世界 box-scan 守卫负责 -->
  <div class="fn-col">
    <!-- 顶行：统计单行（左）+ 页签胶囊（右） -->
    <div class="fn-head">
      <span class="st">评论 <b>{{ commentCount }}</b> · 已看 <b>{{ viewedCount }}</b> 商品 · 浏览 <b>{{ viewCount }}</b> 次 · 聊天 <b>{{ chatDays }}</b> 次 <b>{{ chatCount }}</b> 条</span>
      <div class="fn-tabs">
        <div class="fn-tab" :class="{ active: tab === 'note' }" @mouseenter="tab = 'note'">备注</div>
        <div class="fn-tab" :class="{ active: tab === 'trend' }" @mouseenter="tab = 'trend'">趋势</div>
      </div>
    </div>

    <div class="fn-body">
      <!-- 备注 tab：只读边框盒（渲染已存富文本）+ 全屏按钮，非全屏不可编辑 -->
      <div v-show="tab === 'note'" class="fn-editor">
        <div class="fn-note-view">
          <div v-if="noteText" class="fn-note-text" v-html="noteText"></div>
          <div v-else class="fn-note-text empty">备注这家工厂...</div>
          <button class="fn-full" title="全屏编辑（富文本）" @click="fullscreen = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 趋势 tab：三线折线图铺满 -->
      <div v-show="tab === 'trend'" class="fn-trend">
        <div class="fn-chart-title">
          <span class="t">近30天趋势</span>
          <span class="v">
            <i class="d" style="background:#8faedd"></i>浏览 <span class="num">{{ viewTotal }}</span>
            · <i class="d" style="background:#c9975c"></i>聊天 <span class="num">{{ chatTotal }}</span> 条
            · <i class="d" style="background:#8fbf9f"></i>商品 <span class="num">{{ prodTotal }}</span> 款
          </span>
        </div>
        <div ref="chartEl" class="fn-chart-box"></div>
      </div>
    </div>

    <!-- 全屏富文本编辑（Teleport 到 body，z-index 顶格；只有全屏可编辑） -->
    <Teleport to="body">
      <div v-if="fullscreen" class="fn-fs">
        <div class="fn-fs-head">
          <span class="name">{{ factoryName }}</span>
          <span class="sub">全屏编辑备注</span>
          <button class="exit-btn" title="退出全屏" @click="closeFullscreen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
              <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
        <CommentInput kind="supplier" :target="factoryName" :memberId="memberId" :repOfferId="offerId"
          placeholder="备注这家工厂，编辑后自动保存..." :hideFullscreen="true" @saved="onSaved" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.fn-col {
  box-sizing: border-box;
  flex: 1 1 auto;
  width: 100%;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif;
  font-size: 12px;
  color: #666;
  background: #fff;
}

/* 顶行：统计单行（左）+ 页签胶囊（右），不挤内容区 */
.fn-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  min-height: 20px;
}
.fn-head .st { font-size: 9px; color: #a0a0a0; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fn-head .st b { color: #c9975c; font-weight: 600; font-size: 10px; }

/* 页签胶囊：右上小签，鼠标放上去即切（active 金底白字） */
.fn-tabs {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.fn-tab {
  padding: 2px 9px;
  font-size: 10px;
  color: #999;
  cursor: default;
  user-select: none;
  line-height: 1.4;
  transition: all .15s;
}
.fn-tab + .fn-tab { border-left: 1px solid #f2f2f2; }
.fn-tab:hover { color: #c9975c; }
.fn-tab.active { background: #c9975c; color: #fff; font-weight: 600; }

.fn-body { flex: 1 1 auto; min-height: 0; display: flex; }

/* 备注 tab：只读边框盒 */
.fn-editor { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.fn-note-view {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  background: #fff;
  transition: border-color .2s;
  overflow: hidden;
}
.fn-note-view:hover { border-color: #c9975c; }
.fn-note-text {
  padding: 6px 34px 6px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #333;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  word-break: break-all;
}
/* 空备注 = 灰色占位文字 */
.fn-note-text.empty { color: #bbb; }
.fn-note-text :deep(b) { color: #c9975c; }
/* 全屏按钮：与 CommentInput .fullscreen-btn 同款 */
.fn-full {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.fn-full:hover { background: #f0f0f0; color: #333; }

/* 趋势 tab：标题行（自带三色图例点）+ 折线图铺满 */
.fn-trend { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.fn-chart-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1.2;
  margin-bottom: 2px;
  flex-shrink: 0;
  padding-right: 4px;
}
.fn-chart-title .t { color: #999; font-size: 10px; font-weight: 500; flex-shrink: 0; }
.fn-chart-title .v { color: #999; font-weight: 600; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fn-chart-title .v .num { color: #c9975c; }
.fn-chart-title .d { display: inline-block; width: 6px; height: 6px; border-radius: 2px; margin-right: 2px; vertical-align: baseline; }
.fn-chart-box { width: 100%; flex: 1 1 auto; height: auto; min-height: 38px; }

/* 全屏富文本编辑（Teleport 到 body，样式需穿透 scoped → 用非 scoped 块见下方） */
</style>

<style>
/* 全屏覆盖层：Teleport 到 body 后不在组件 scoped 范围，需全局样式（类名 fn-fs 专属前缀防冲突） */
.fn-fs {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.fn-fs-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid #f5f5f5;
  flex-shrink: 0;
}
.fn-fs-head .name { font-size: 13px; font-weight: 600; color: #333; }
.fn-fs-head .sub { font-size: 11px; color: #c9975c; }
.fn-fs-head .exit-btn {
  margin-left: auto;
  width: 28px; height: 28px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.fn-fs-head .exit-btn:hover { background: #f0f0f0; color: #333; }
/* 内嵌 CommentInput 填满余下空间 */
.fn-fs .rich-editor-wrap { flex: 1; min-height: 0; }
.fn-fs .editor-container { min-height: 0; }
</style>
