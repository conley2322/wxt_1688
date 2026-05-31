<template>
  <div class="comment-item">
    <div class="cmt-avatar" :style="{ background: comment.color }">{{ comment.initial }}</div>
    <div class="cmt-body">
      <div class="cmt-header">
        <span class="cmt-name">{{ comment.user_name }}</span>
        <span class="cmt-time">{{ timeAgo }}</span>
      </div>
      <div class="cmt-text" v-html="comment.text"></div>
      <div class="cmt-actions">
        <span class="cmt-like" :class="{ liked }" @click.stop="$emit('toggle-like', comment.id)">
          <svg width="12" height="12" viewBox="0 0 24 24" :fill="liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          {{ comment.likes > 0 ? comment.likes : '' }}
        </span>
        <template v-if="isMine">
          <span class="cmt-action-btn" @click.stop="$emit('edit', comment)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </span>
          <span class="cmt-action-btn cmt-delete-btn" @click.stop="$emit('delete', comment.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </span>
        </template>
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

defineEmits(['toggle-like', 'edit', 'delete'])

const liked = computed(() =>
  props.comment.liked_by && props.comment.liked_by.includes(props.currentUser)
)

const isMine = computed(() => props.comment.user_name === props.currentUser)

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
.cmt-action-btn {
  font-size: 12px;
  color: #bbb;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  transition: all 0.15s;
}
.cmt-action-btn:hover {
  background: #f0f0f0;
  color: #666;
}
.cmt-delete-btn:hover {
  background: #fff0f0;
  color: #e74c3c;
}
</style>