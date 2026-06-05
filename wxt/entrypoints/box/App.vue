<script setup>
import { computed } from 'vue'

const props = defineProps(['parentEl', 'offerId', 'batchCache'])

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
const iHaveViewed = computed(() => info.value?.i_have_viewed ?? false)

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
  <div v-if="offer_id" class="box-card">
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
