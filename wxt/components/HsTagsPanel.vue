<template>
  <div v-if="tags.length" class="hs-tags-panel">
    <span v-for="(tag, i) in tags" :key="i" class="hs-tag"
      :title="tag.tooltip">{{ tag.text }}</span>
  </div>
  <div v-else class="hs-note--empty">{{ emptyText }}</div>
</template>

<script setup>
defineProps({
  tags: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无标签' }
})
</script>

<style scoped>
.hs-tags-panel {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.hs-tag {
  flex: 1 1 48px;
  font-size: 10px;
  line-height: 18px;
  color: #fff;
  border-radius: 2px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hs-tag:nth-child(6n+1) { background: #ff6a00; }
.hs-tag:nth-child(6n+2) { background: #2ecc71; }
.hs-tag:nth-child(6n+3) { background: #3498db; }
.hs-tag:nth-child(6n+4) { background: #9b59b6; }
.hs-tag:nth-child(6n+5) { background: #e74c3c; }
.hs-tag:nth-child(6n+6) { background: #1abc9c; }

.hs-note--empty {
  color: #ccc;
  font-style: italic;
  font-size: 11px;
}
</style>