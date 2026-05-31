<template>
  <div v-if="comments.length" class="hs-comments">
    <div v-for="(c, i) in comments" :key="i" class="hs-comment" :title="c.tooltip">
      <div class="hs-cmt-avatar" :style="{ background: c.color }">{{ c.initial }}</div>
      <div class="hs-cmt-body">
        <div class="hs-cmt-text">{{ c.text }}</div>
      </div>
      <span class="hs-cmt-date">{{ c.date }}</span>
    </div>
  </div>
  <div v-else class="hs-note--empty">{{ emptyText }}</div>
</template>

<script setup>
defineProps({
  comments: { type: Array, default: () => [] },
  emptyText: { type: String, default: '暂无评论' }
})
</script>

<style scoped>
.hs-comments {
  font-size: 0;
  overflow-y: auto;
  flex: 1;
}

.hs-comments::-webkit-scrollbar {
  width: 4px;
}

.hs-comments::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}

.hs-comments::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}

.hs-comment {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-bottom: 2px;
  min-width: 0;
}

.hs-comment:last-child {
  margin-bottom: 0;
}

.hs-cmt-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  margin-top: 1px;
  /* cursor: default;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); */
}

/* .hs-cmt-avatar:hover {
  transform: scale(1.3);
  z-index: 1;
}
 */
.hs-cmt-body {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  line-height: 1.4;
}

.hs-cmt-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 10px;
  color: #666;
  word-break: break-all;
}

.hs-cmt-date {
  font-size: 9px;
  color: #bbb;
  flex-shrink: 0;
  white-space: nowrap;
  line-height: 1.6;
  padding-left: 2px;
}

.hs-note--empty {
  color: #ccc;
  font-style: italic;
  font-size: 11px;
}
</style>
