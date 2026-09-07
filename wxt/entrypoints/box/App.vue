<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// box1 图表按需引入（减小打包体积）
echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps(['parentEl', 'offerId', 'batchCache', 'queryCountMode', 'chartType'])

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

// ── 从批量缓存中读数据 ──
const info = computed(() => props.batchCache?.[offer_id] || null)

const viewCount = computed(() => info.value?.view_count ?? 0)
const commentCount = computed(() => info.value?.comment_count ?? 0)
const tagCount = computed(() => info.value?.tag_count ?? 0)
const queryCount = computed(() => props.queryCountMode === 'mine'
  ? (info.value?.my_query_count ?? 0)
  : (info.value?.query_count ?? 0))
const lastQueriedAt = computed(() => info.value?.last_queried_at || '')

// box1 头像：mine 模式显示我自己的头像，total 模式显示团队所有查询用户的头像栈
const queryUsers = computed(() => info.value?.query_users || [])
const box1Avatars = computed(() => {
  if (props.queryCountMode === 'mine') {
    const me = queryUsers.value.find(u => u.is_me)
    if (!me) return []
    return [{
      initial: me.initial || me.username?.charAt(0) || '?',
      color: avatarColor(me),
      tooltip: `${me.username} · ${me.count}次`
    }]
  }
  return queryUsers.value.map(v => ({
    initial: v.initial || v.username?.charAt(0) || '?',
    color: avatarColor(v),
    tooltip: `${v.username} · ${v.count}次`
  }))
})

// 时间显示规则：今天→时分秒；本月→「日日 时分秒」；今年→「月-日 时分秒」；跨年→完整日期
function formatQueryTime(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(/-/g, '/'))
  if (isNaN(d.getTime())) return String(s)
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) return hms
  const sameYear = d.getFullYear() === now.getFullYear()
  if (sameYear && d.getMonth() === now.getMonth()) return `${d.getDate()}日 ${hms}`
  if (sameYear) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hms}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hms}`
}
const lastQueriedAtText = computed(() => formatQueryTime(lastQueriedAt.value))
const iHaveViewed = computed(() => info.value?.i_have_viewed ?? false)

// ── box1 时间轴：最近一周查询过的用户，按时间倒序，友好时间（今天/昨天/周几 + 时段）──
const timelineItems = computed(() => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return queryUsers.value
    .filter(u => u.last_queried_at)
    .map(u => {
      const d = new Date(String(u.last_queried_at).replace(' ', 'T'))
      if (isNaN(d.getTime())) return null
      const diffDays = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
      if (diffDays < 0 || diffDays > 7) return null
      const pad = n => String(n).padStart(2, '0')
      const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
      const hour = d.getHours()
      const period = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
      let time
      if (diffDays === 0) time = `今天 ${period} ${hm}`
      else if (diffDays === 1) time = `昨天 ${period} ${hm}`
      else time = `${weekdays[d.getDay()]} ${period} ${hm}`
      return {
        username: u.username,
        initial: u.initial || u.username?.charAt(0) || '?',
        color: avatarColor(u),
        count: u.count,
        time,
        ts: d.getTime()
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts)
})

// ── box1 图表：谁查询了多少次（图型由后台设置决定：柱状/折线/面积/饼状/环形）──
const chartEl = ref(null)
let chartInstance = null

function renderChart() {
  if (!chartEl.value || !queryUsers.value.length) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value)
  }
  const type = props.chartType
  const users = [...queryUsers.value].sort((a, b) => b.count - a.count).slice(0, 8)

  // 饼状图 / 环形图
  if (type === 'pie' || type === 'ring') {
    chartInstance.setOption({
      tooltip: {
        trigger: 'item',
        textStyle: { fontSize: 11 },
        formatter: p => `${p.data.fullName}：${p.data.value} 次`
      },
      series: [{
        type: 'pie',
        radius: type === 'ring' ? ['38%', '68%'] : '68%',
        center: ['50%', '50%'],
        label: { show: users.length <= 4, fontSize: 9, color: '#9ca3af', formatter: '{b}' },
        labelLine: { length: 6, length2: 4, lineStyle: { color: '#d1d5db' } },
        data: users.map(u => ({
          value: u.count,
          name: u.username,
          fullName: u.username,
          itemStyle: { color: u.is_me ? '#c9975c' : undefined }
        }))
      }]
    }, true)
    return
  }

  // 柱状图 / 折线图 / 面积图
  const isLine = type === 'line' || type === 'area'
  const seriesColor = isLine ? '#c9975c' : '#8faedd'
  const series = {
    type: isLine ? 'line' : 'bar',
    data: users.map(u => ({
      value: u.count,
      fullName: u.username,
      itemStyle: {
        color: u.is_me ? '#c9975c' : seriesColor,
        ...(isLine || type === 'area' ? {} : { borderRadius: [3, 3, 0, 0] })
      }
    })),
    barMaxWidth: 16,
    smooth: true,
    symbolSize: 5,
    lineStyle: { width: 2, color: '#c9975c' },
    itemStyle: isLine || type === 'area' ? { color: '#c9975c' } : {}
  }
  if (type === 'area') {
    series.areaStyle = { opacity: 0.25 }
  }
  chartInstance.setOption({
    grid: { left: 30, right: 8, top: 14, bottom: 20 },
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: 11 },
      formatter: p => `${p[0].data.fullName}：${p[0].value} 次`
    },
    xAxis: {
      type: 'category',
      data: users.map(u => u.initial),
      axisLabel: { fontSize: 9, interval: 0, color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 9, color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [series]
  }, true)
}

onMounted(() => nextTick(renderChart))
onUnmounted(() => { chartInstance?.dispose(); chartInstance = null })
watch(() => info.value?.query_users, () => nextTick(renderChart))
watch(() => props.chartType, () => nextTick(renderChart))

// 头像颜色（用户自选 > 哈希降级）
const colorPool = ['#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']
function avatarColor(v) {
  if (v.avatar_color) return v.avatar_color
  let hash = 0
  const name = v.username || ''
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colorPool[Math.abs(hash) % colorPool.length]
}

// 头像栈
const viewerAvatars = computed(() =>
  (info.value?.viewers || []).map(v => ({
    initial: v.initial || v.username?.charAt(0) || '?',
    tooltip: `${v.username} · ${v.count}次`,
    color: avatarColor(v)
  }))
)

// 小圆点颜色：绿色=我看过，灰色=我没看过
const dotColor = computed(() => {
  if (iHaveViewed.value) return '#52c41a'
  return '#d9d9d9'
})
</script>

<template>
  <template v-if="offer_id">
    <div class="box-card">
      <div class="box-row">
        <!-- 小圆点 -->
        <span class="box-dot" :style="{ background: dotColor }"></span>

        <!-- 浏览数 -->
        <span class="box-stat" title="浏览">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          {{ viewCount }}
        </span>

        <!-- 评论数 -->
        <span class="box-stat" title="评论">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {{ commentCount }}
        </span>

        <!-- 标签数 -->
        <span class="box-stat" title="标签">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          {{ tagCount }}
        </span>

        <!-- 头像栈 -->
        <span v-if="viewerAvatars.length" class="avatar-stack">
          <span
            v-for="(v, i) in viewerAvatars.slice(0, 3)"
            :key="i"
            class="avatar-dot"
            :style="{ background: v.color, zIndex: viewerAvatars.length - i }"
            :title="v.tooltip"
          >{{ v.initial }}</span>
          <span v-if="viewerAvatars.length > 3" class="avatar-more">+{{ viewerAvatars.length - 3 }}</span>
        </span>
      </div>
    </div>

    <!-- box1：被查询次数 + 谁查询了多少次（图型由后台"系统设置"决定：柱状/折线/面积/饼状/环形/时间轴） -->
    <div class="box-card box1-card">
      <div class="box-row">
        <span class="box-stat box1-stat" :title="queryCountMode === 'mine' ? '我查询该商品信息的次数（每次实际查询 +1）' : '全团队查询该商品信息的总次数（每次实际查询 +1）'">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          {{ queryCountMode === 'mine' ? '我查' : '查询' }} {{ queryCount }} 次
        </span>
        <span v-if="box1Avatars.length" class="avatar-stack box1-avatars">
          <span
            v-for="(v, i) in box1Avatars.slice(0, 3)"
            :key="i"
            class="avatar-dot"
            :style="{ background: v.color, zIndex: box1Avatars.length - i }"
            :title="v.tooltip"
          >{{ v.initial }}</span>
          <span v-if="box1Avatars.length > 3" class="avatar-more">+{{ box1Avatars.length - 3 }}</span>
        </span>
      </div>
      <template v-if="props.chartType === 'timeline'">
        <div class="box1-timeline">
          <div v-if="!timelineItems.length" class="box1-timeline-empty">最近一周暂无查询记录</div>
          <div v-for="(t, i) in timelineItems" :key="i" class="box1-timeline-item" :title="`${t.username} 查询了 ${t.count} 次`">
            <span class="avatar-dot" :style="{ background: t.color }">{{ t.initial }}</span>
            <span class="tl-name">{{ t.username }}</span>
            <span class="tl-time">{{ t.time }}</span>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-if="lastQueriedAtText" class="box1-sub">上次查询：{{ lastQueriedAtText }}</div>
        <div ref="chartEl" class="box1-chart"></div>
      </template>
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
/* ── box1：被查询次数 + 图表 ── */
.box1-card {
  height: auto;
  padding: 6px 8px 2px;
  display: block;
}
.box1-chart {
  width: 100%;
  height: 104px;
  margin-top: 2px;
}
.box1-stat {
  color: #c9975c;
  font-weight: 600;
}
.box1-stat svg {
  opacity: 0.9;
}
.box1-sub {
  font-size: 10px;
  color: #9ca3af;
  margin: 2px 0 0;
}
.box1-timeline {
  max-height: 104px;
  overflow-y: auto;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 2px;
}
.box1-timeline-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.box1-timeline-item .avatar-dot {
  width: 16px;
  height: 16px;
  font-size: 8px;
  flex-shrink: 0;
}
.tl-name {
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.tl-time {
  color: #9ca3af;
  white-space: nowrap;
  margin-left: auto;
}
.box1-timeline-empty {
  font-size: 11px;
  color: #c0c4cc;
  text-align: center;
  padding: 30px 0;
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
.avatar-dot:not(:first-child) { margin-left: -5px; }
.avatar-more {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  background: #e0e0e0; color: #999; font-size: 8px; font-weight: 500;
  border: 1.5px solid #f5f6f8; margin-left: -5px; flex-shrink: 0;
}
</style>
