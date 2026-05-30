<template>
  <div class="tag-cloud">
    <span class="cloud-label">🏷 标签云</span>
    <div class="cloud-tags">
      <span
        v-for="tag in sortedTags"
        :key="tag.id"
        class="cloud-tag"
        :class="{ 'my-tag': tag.creator === currentUser, liked: isLiked(tag) }"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="handleClick(tag)"
        @mouseenter="hoveredTag = tag"
        @mouseleave="hoveredTag = null"
      >
        {{ tag.text }}

        <!-- 私有标签：闭眼图标 -->
        <svg v-if="tag.visibility === 'private'" class="tag-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>

        <!-- 点赞心形图标 -->
        <svg v-if="isLiked(tag)" class="tag-icon tag-like-icon" width="12" height="12" viewBox="0 0 24 24" :fill="tag.font_color" :stroke="tag.font_color" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <svg v-else class="tag-icon tag-like-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="tag.font_color" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>

        <!-- Tooltip -->
        <div v-if="hoveredTag === tag" class="tag-tooltip">
          <div>标签：{{ tag.text }}</div>
          <div>创建者：{{ tag.creator }}</div>
          <div>创建时间：{{ formatDate(tag.created_at) }}</div>
          <div>认同人数：{{ tag.like_count }}人</div>
          <div v-if="isLiked(tag)" class="tooltip-liked">❤️ 已点赞</div>
        </div>
      </span>
      <span v-if="sortedTags.length === 0" class="cloud-empty">暂无标签</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  tags: { type: Array, required: true },
  currentUser: { type: String, required: true },
})

const emit = defineEmits(['toggle-like', 'remove'])

const hoveredTag = ref(null)

const sortedTags = computed(() => {
  const my = []
  const others = []
  for (const tag of props.tags) {
    if (tag.visibility === 'private' && tag.creator !== props.currentUser) continue
    if (tag.creator === props.currentUser) {
      my.push(tag)
    } else {
      others.push(tag)
    }
  }
  my.sort((a, b) => b.like_count - a.like_count)
  others.sort((a, b) => b.like_count - a.like_count)
  return [...my, ...others]
})

function isLiked(tag) {
  return tag.liked_by && tag.liked_by.includes(props.currentUser)
}

function handleClick(tag) {
  if (tag.creator === props.currentUser) {
    emit('remove', tag.id)
  } else {
    emit('toggle-like', tag.id)
  }
}

function formatDate(iso) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
</script>

<style scoped>
.tag-cloud {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}
.cloud-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
  display: block;
}
.cloud-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cloud-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
  line-height: 18px;
  border: 2px solid transparent;
}
.cloud-tag:hover {
  opacity: 0.8;
}
.cloud-tag.my-tag {
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}
.cloud-tag.liked {
  box-shadow: 0 0 0 2px #1677ff;
}
.tag-icon {
  flex-shrink: 0;
}
.tag-like-icon {
  transition: transform 0.15s;
}
.cloud-tag:hover .tag-like-icon {
  transform: scale(1.2);
}
.tag-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 99999;
  line-height: 1.6;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  pointer-events: none;
}
.tooltip-liked {
  color: #ff6b6b;
}
.cloud-empty {
  font-size: 12px;
  color: #ccc;
}
</style>
