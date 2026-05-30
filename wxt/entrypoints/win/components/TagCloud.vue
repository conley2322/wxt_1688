<template>
  <div class="tag-cloud">
    <span class="cloud-label">🏷 标签云</span>
    <div class="cloud-tags">
      <span
        v-for="tag in sortedTags"
        :key="tag.id"
        class="cloud-tag"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="handleClick(tag)"
        @mouseenter="hoveredTag = tag"
        @mouseleave="hoveredTag = null"
      >
        {{ tag.text }}
        <span class="tag-count" v-if="tag.like_count > 0">&times;{{ tag.like_count }}</span>
        <span v-if="tag.visibility === 'private'" class="tag-lock">🔒</span>

        <div v-if="hoveredTag === tag" class="tag-tooltip">
          <div>标签：{{ tag.text }}</div>
          <div>创建者：{{ tag.creator }}</div>
          <div>创建时间：{{ formatDate(tag.created_at) }}</div>
          <div>认同人数：{{ tag.like_count }}人</div>
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

const emit = defineEmits(['like', 'unlike', 'remove'])

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

function handleClick(tag) {
  if (tag.creator === props.currentUser) {
    emit('remove', tag.id)
  } else {
    emit('like', tag.id)
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
  transition: opacity 0.15s;
  line-height: 18px;
}
.cloud-tag:hover {
  opacity: 0.8;
}
.tag-count {
  font-size: 10px;
  opacity: 0.8;
}
.tag-lock {
  font-size: 10px;
}
.tag-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10;
  line-height: 1.6;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.cloud-empty {
  font-size: 12px;
  color: #ccc;
}
</style>
