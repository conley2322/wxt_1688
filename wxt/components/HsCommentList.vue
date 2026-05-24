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
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.hs-comments::-webkit-scrollbar {
  display: none;
}

.hs-comment {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 1px;
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
  margin-top: 2px;
}

.hs-cmt-body {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  line-height: 1.5;
}

.hs-cmt-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11px;
  color: #555;
  word-break: break-all;
}

.hs-cmt-date {
  font-size: 9px;
  color: #bbb;
  flex-shrink: 0;
  white-space: nowrap;
  line-height: 1.6;
  padding-left: 4px;
}

.hs-note--empty {
  color: #ccc;
  font-style: italic;
  font-size: 11px;
}
</style>