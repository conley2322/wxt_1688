<template>
  <div class="tag-cloud">
    <div class="cloud-tags">
      <span
        v-for="tag in sortedTags"
        :key="tag.id"
        class="cloud-tag"
        :class="{ 'my-tag': tag.creator === currentUser }"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        :title="tag.creator === currentUser ? `我的标签 · ${formatDate(tag.assigned_at)}` : `${tag.creator} 添加 · ${formatDate(tag.assigned_at)}`"
      >
        {{ tag.text.length > 10 ? tag.text.slice(0, 10) + '…' : tag.text }}

        <!-- 私有标签标识 -->
        <svg v-if="tag.visibility === 'private'" class="tag-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>

        <!-- 我的标签 hover 显示删除按钮 -->
        <span v-if="tag.creator === currentUser" class="tag-remove" @click.stop="$emit('remove', tag.id)">×</span>
      </span>
      <span v-if="sortedTags.length === 0" class="cloud-empty">暂无标签</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tags: { type: Array, required: true },
  currentUser: { type: String, required: true },
})

defineEmits(['remove'])

const sortedTags = computed(() => {
  const my = []
  const others = []
  for (const tag of props.tags) {
    // 不显示别人的私有标签
    if (tag.visibility === 'private' && tag.creator !== props.currentUser) continue
    if (tag.creator === props.currentUser) {
      my.push(tag)
    } else {
      others.push(tag)
    }
  }
  return [...my, ...others]
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes(' ') && !dateStr.includes('T') ? dateStr.replace(' ', 'T') + '.000Z' : dateStr)
  if (isNaN(d)) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day}`
}
</script>

<style scoped>
.tag-cloud {
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
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
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 18px;
  position: relative;
}
.cloud-tag:not(.my-tag) {
  opacity: 0.7;
  cursor: default;
}
.cloud-tag.my-tag {
  cursor: pointer;
  padding-right: 4px;
}
.cloud-tag.my-tag:hover {
  opacity: 0.85;
}
.tag-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.tag-remove {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  margin-left: 1px;
  opacity: 0.5;
}
.tag-remove:hover { opacity: 1; }
.tag-remove:hover {
  opacity: 1;
}
.cloud-empty {
  font-size: 12px;
  color: #ccc;
}
</style>
