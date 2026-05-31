<template>
  <div class="comment-item" :data-cmt-id="comment.id">
    <div class="cmt-avatar" :style="{ background: avatarColor }">{{ avatarInitial }}</div>
    <div class="cmt-body">
      <div class="cmt-header">
        <span class="cmt-name">{{ comment.username }}</span>
        <span class="cmt-time">{{ timeAgo }}</span>
      </div>
      <div ref="textRef" class="cmt-text" v-html="resolvedHtml"></div>
      <div class="cmt-actions">
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
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Viewer from 'viewerjs'
import 'viewerjs/dist/viewer.css'

const props = defineProps({
  comment: { type: Object, required: true },
  currentUser: { type: String, default: '' },
})

defineEmits(['edit', 'delete'])

const resolvedHtml = ref(props.comment.text)
const textRef = ref(null)
let viewer = null

onMounted(async () => {
  const html = props.comment.text || ''
  if (/\/uploads\//.test(html)) {
    let result = html
    const imgRegex = /src="([^"]*\/uploads\/[^"]*)"/g
    let match
    while ((match = imgRegex.exec(html)) !== null) {
      try {
        const res = await fetch(match[1])
        const blob = await res.blob()
        result = result.replace(match[1], URL.createObjectURL(blob))
      } catch {}
    }
    resolvedHtml.value = result
  }

  // 等 DOM 渲染后初始化 viewerjs
  await nextTick()
  setTimeout(() => {
    if (textRef.value && textRef.value.querySelector('img')) {
      viewer = new Viewer(textRef.value, {
        inline: false,
        navbar: false,
        toolbar: {
          zoomIn: true, zoomOut: true, oneToOne: true, reset: true,
          prev: true, play: false, next: true,
          rotateLeft: true, rotateRight: true,
          flipHorizontal: true, flipVertical: true,
        },
      })
    }
  }, 300)
})

onBeforeUnmount(() => {
  if (viewer) { viewer.destroy(); viewer = null }
})

const isMine = computed(() => props.comment.username === props.currentUser)

const colorPool = ['#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']
const avatarColor = computed(() => {
  let hash = 0; const name = props.comment.username || ''
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colorPool[Math.abs(hash) % colorPool.length]
})
const avatarInitial = computed(() => (props.comment.username || '?').charAt(0).toUpperCase())

function parseDate(dateStr) {
  if (!dateStr) return null
  if (dateStr.includes(' ') && !dateStr.includes('T')) return new Date(dateStr.replace(' ', 'T') + '.000Z')
  return new Date(dateStr)
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const t = parseDate(dateStr)
  if (!t || isNaN(t)) return ''
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${m}/${d}`
}

const timeAgo = computed(() => {
  if (props.comment.updated_at) return formatTime(props.comment.updated_at) + ' (已编辑)'
  return formatTime(props.comment.created_at)
})
</script>

<style scoped>
.comment-item { display: flex; gap: 8px; padding: 10px 12px; }
.comment-item + .comment-item { border-top: 1px solid #f5f5f5; }
.cmt-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.cmt-body { flex: 1; min-width: 0; }
.cmt-header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.cmt-name { font-size: 12px; font-weight: 600; color: #333; }
.cmt-time { font-size: 11px; color: #bbb; }
.cmt-text { font-size: 13px; color: #1a1a1a; line-height: 1.5; word-break: break-word; margin-bottom: 4px; overflow-wrap: break-word; }
.cmt-text :deep(ul), .cmt-text :deep(ol) { padding-left: 18px; margin: 4px 0; }
.cmt-text :deep(li) { margin-bottom: 2px; }
.cmt-text :deep(p) { margin: 0 0 4px; }
.cmt-text :deep(p:last-child) { margin-bottom: 0; }
.cmt-text :deep(img) { max-width: 100%; max-height: 300px; height: auto; border-radius: 4px; cursor: pointer; object-fit: contain; }
.cmt-actions { display: flex; align-items: center; }
.cmt-action-btn { font-size: 12px; color: #bbb; cursor: pointer; padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; transition: all 0.15s; }
.cmt-action-btn:hover { background: #f0f0f0; color: #666; }
.cmt-delete-btn:hover { background: #fff0f0; color: #e74c3c; }
</style>

<style>
.viewer-container { z-index: 2147483647 !important; }
.viewer-toolbar { z-index: 2147483648 !important; }
</style>
