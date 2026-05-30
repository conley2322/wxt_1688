<template>
  <div class="tag-pool">
    <div v-if="availableTags.length" class="pool-section">
      <span class="pool-label">可添加：</span>
      <span
        v-for="tag in availableTags"
        :key="tag.id"
        class="pool-tag"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="$emit('assign', tag.id)"
      >
        {{ tag.text }}
      </span>
    </div>
    <div v-if="assignedTags.length" class="pool-section">
      <span class="pool-label">已添加（点击取消）：</span>
      <span
        v-for="tag in assignedTags"
        :key="tag.id"
        class="pool-tag assigned"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="$emit('remove', tag.id)"
      >
        {{ tag.text }} &times;{{ tag.like_count }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  availableTags: { type: Array, required: true },
  assignedTags: { type: Array, required: true },
})
defineEmits(['assign', 'remove'])
</script>

<style scoped>
.tag-pool {
  padding: 6px 12px;
  border-top: 1px solid #f0f0f0;
}
.pool-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.pool-section:last-child {
  margin-bottom: 0;
}
.pool-label {
  font-size: 11px;
  color: #999;
  width: 100%;
  margin-bottom: 2px;
}
.pool-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  transition: opacity 0.15s;
  line-height: 18px;
}
.pool-tag:hover {
  opacity: 0.8;
}
.pool-tag.assigned {
  opacity: 0.7;
}
</style>
