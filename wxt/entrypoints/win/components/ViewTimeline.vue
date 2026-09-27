<script setup>
// 商品浏览时间轴：谁在什么时候浏览了这个商品
// 正序排列（旧在上、新在下，从下往上长），滚动到底部自动触发同步刷新
import { ref, watch, nextTick, onMounted } from 'vue'
import { api } from '@/utils/dataClient.js'

const props = defineProps({
  target: { type: [String, Number], required: true },
})

const list = ref([])
const scrollEl = ref(null)
const refreshing = ref(false)
let lastRefreshAt = 0
let atBottom = true // 打开时定位到最新（底部）

async function load(scrollToBottom) {
  const res = await api(`/api/v1/products/${encodeURIComponent(props.target)}/view-timeline`)
  if (res.code === 200) {
    list.value = res.data
    if (scrollToBottom) await nextTick(scrollToEnd)
  }
}

function scrollToEnd() {
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  // 距底部 40px 以内视为"贴底"
  atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  if (atBottom) triggerRefresh()
}

// 下拉到底自动刷新：先让 background 同步，再重载；10 秒冷却
async function triggerRefresh() {
  if (refreshing.value) return
  const now = Date.now()
  if (now - lastRefreshAt < 10000) return
  refreshing.value = true
  lastRefreshAt = now
  try {
    await browser.runtime.sendMessage({ type: 'remote-sync' })
    await load(false)
    await nextTick(scrollToEnd)
  } catch {
    // 未连接服务器时静默忽略
  } finally {
    setTimeout(() => { refreshing.value = false }, 800)
  }
}

onMounted(() => load(true))
watch(() => props.target, () => load(true))

const AVATAR_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
function avatarColor(name, mine) {
  if (mine) return '#1677ff'
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function fmt(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return `${sameDay ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="vt-wrap">
    <div ref="scrollEl" class="vt-scroll" @scroll="onScroll">
      <div v-if="!list.length" class="vt-empty">暂无浏览记录</div>

      <div v-for="(item, i) in list" :key="i" class="vt-item">
        <span class="vt-dot" :style="{ background: avatarColor(item.nickname, item.mine) }"></span>
        <span class="vt-line"></span>
        <span class="vt-avatar" :style="{ background: avatarColor(item.nickname, item.mine) }">
          {{ (item.nickname || '?').slice(0, 1) }}
        </span>
        <span class="vt-name">{{ item.mine ? '我' : item.nickname }}</span>
        <span class="vt-time">{{ fmt(item.viewed_at) }}</span>
      </div>
    </div>
    <div class="vt-status">{{ refreshing ? '正在刷新…' : '滚动到底部自动刷新' }}</div>
  </div>
</template>

<style scoped>
.vt-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.vt-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 8px 2px 10px;
}
.vt-empty {
  font-size: 12px;
  color: #bbb;
  text-align: center;
  padding: 20px 0;
}
.vt-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 0;
}
/* 时间轴竖线 */
.vt-line {
  position: absolute;
  left: 14px;
  top: 0;
  bottom: -5px;
  width: 2px;
  background: #eee;
  z-index: 0;
}
.vt-item:last-child .vt-line {
  display: none;
}
.vt-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid #fff;
  z-index: 1;
  flex-shrink: 0;
}
.vt-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.vt-name {
  font-size: 12px;
  color: #333;
  font-weight: 600;
}
.vt-time {
  font-size: 11px;
  color: #aaa;
  margin-left: auto;
}
.vt-status {
  font-size: 10px;
  color: #c0c4cc;
  text-align: center;
  padding: 2px 0 3px;
  flex-shrink: 0;
}
</style>
