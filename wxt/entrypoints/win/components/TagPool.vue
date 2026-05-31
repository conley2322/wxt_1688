<template>
  <div class="tag-pool">
    <div v-if="availableTags.length" class="pool-section">
      <span class="pool-label">可添加标签：</span>
      <span
        v-for="tag in availableTags"
        :key="tag.id"
        class="pool-tag"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="$emit('assign', tag.id)"
        @contextmenu.prevent="$emit('deleteTag', tag.id)"
      >
        {{ tag.text }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  availableTags: { type: Array, required: true },
})
defineEmits(['assign', 'deleteTag'])
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
</style>
