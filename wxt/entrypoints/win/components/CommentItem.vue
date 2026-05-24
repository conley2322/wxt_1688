<template>
  <div class="comment-item">
    <div class="cmt-avatar" :style="{ background: comment.color }">{{ comment.initial }}</div>
    <div class="cmt-body">
      <div class="cmt-header">
        <span class="cmt-name">{{ comment.user_name }}</span>
        <span class="cmt-time">{{ timeAgo }}</span>
      </div>
      <div class="cmt-text">{{ comment.text }}</div>
      <div class="cmt-actions">
        <span class="cmt-like" :class="{ liked }" @click.stop="$emit('toggle-like', comment.id)">
          👍 {{ comment.likes > 0 ? comment.likes : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  comment: { type: Object, required: true },
  currentUser: { type: String, default: '' },
})

defineEmits(['toggle-like'])

const liked = computed(() =>
  props.comment.liked_by && props.comment.liked_by.includes(props.currentUser)
)

const timeAgo = computed(() => {
  const now = new Date()
  const t = new Date(props.comment.created_at)
  const diff = Math.floor((now - t) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}周前`
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${m}/${d}`
})
</script>

<style scoped>
.comment-item {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
}
.comment-item + .comment-item {
  border-top: 1px solid #f5f5f5;
}
.cmt-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.cmt-body {
  flex: 1;
  min-width: 0;
}
.cmt-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.cmt-name {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}
.cmt-time {
  font-size: 11px;
  color: #bbb;
}
.cmt-text {
  font-size: 13px;
  color: #1a1a1a;
  line-height: 1.5;
  word-break: break-word;
  margin-bottom: 4px;
}
.cmt-actions {
  display: flex;
  align-items: center;
}
.cmt-like {
  font-size: 12px;
  color: #999;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  user-select: none;
  transition: all 0.15s;
}
.cmt-like:hover {
  background: #fff0f0;
}
.cmt-like.liked {
  color: #ff6a00;
}
</style>