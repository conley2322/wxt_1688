<template>
  <div class="rich-editor-wrap" :class="{ fullscreen: isFullscreen }">
    <div class="editor-header">
      <div class="editor-avatar" :style="{ background: userColor }">{{ userInitial }}</div>
      <div class="editor-toolbar">
        <button class="tool-btn" @click="exec('bold')" title="加粗"><b>B</b></button>
        <button class="tool-btn" @click="exec('italic')" title="斜体"><i>I</i></button>
        <button class="tool-btn" @click="exec('strikeThrough')" title="删除线"><s>S</s></button>
        <span class="tool-sep"></span>
        <button class="tool-btn" @click="exec('insertUnorderedList')" title="无序列表">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="tool-btn" @click="exec('insertOrderedList')" title="有序列表">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
            <text x="3" y="8" font-size="8" fill="currentColor" stroke="none">1</text>
            <text x="3" y="14" font-size="8" fill="currentColor" stroke="none">2</text>
            <text x="3" y="20" font-size="8" fill="currentColor" stroke="none">3</text>
          </svg>
        </button>
      </div>
      <div class="editor-actions">
        <button class="action-btn fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏编辑'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <template v-if="!isFullscreen">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </template>
            <template v-else>
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
              <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
            </template>
          </svg>
        </button>
        <button class="action-btn send-btn" :disabled="isEmpty" @click="submit">{{ sendLabel }}</button>
      </div>
    </div>
    <div
      ref="editorRef"
      class="editor-content"
      :class="{ 'is-fullscreen': isFullscreen }"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="onInput"
      @keydown.enter.meta="submit"
      @keydown.enter.ctrl="submit"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  userInitial: { type: String, default: 'C' },
  userColor: { type: String, default: '#ff6a00' },
  placeholder: { type: String, default: '写点什么...' },
  sendLabel: { type: String, default: '评论' },
})

const emit = defineEmits(['send', 'update:text'])

const editorRef = ref(null)
const html = ref('')
const isFullscreen = ref(false)

const isEmpty = computed(() => {
  const text = html.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s/g, '')
  return !text
})

watch(html, (val) => {
  emit('update:text', val)
})

function exec(command, value) {
  document.execCommand(command, false, value || null)
  editorRef.value?.focus()
}

function onInput() {
  html.value = editorRef.value?.innerHTML || ''
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  setTimeout(() => editorRef.value?.focus(), 100)
}

function setText(content) {
  if (editorRef.value) {
    editorRef.value.innerHTML = content || ''
    html.value = content || ''
  }
}

function submit() {
  const content = (editorRef.value?.innerHTML || '').trim()
  const text = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s/g, '')
  if (!text) return
  emit('send', content)
  if (editorRef.value) {
    editorRef.value.innerHTML = ''
    html.value = ''
  }
}

defineExpose({ setText, toggleFullscreen })
</script>

<style scoped>
.rich-editor-wrap {
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}
.rich-editor-wrap.fullscreen {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
}
.editor-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  flex-shrink: 0;
}
.editor-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tool-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 13px;
  transition: all 0.15s;
}
.tool-btn:hover {
  background: #f0f0f0;
  color: #333;
}
.tool-sep {
  width: 1px;
  height: 16px;
  background: #e0e0e0;
  margin: 0 2px;
}
.editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.action-btn {
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.fullscreen-btn {
  width: 28px;
  height: 28px;
  background: transparent;
  color: #999;
}
.fullscreen-btn:hover {
  background: #f0f0f0;
  color: #333;
}
.send-btn {
  background: #1677ff;
  color: #fff;
  font-size: 12px;
  padding: 5px 14px;
  font-weight: 500;
}
.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.send-btn:not(:disabled):hover {
  background: #4096ff;
}
.editor-content {
  min-height: 48px;
  max-height: 120px;
  overflow-y: auto;
  padding: 6px 12px 8px;
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  outline: none;
}
.editor-content.is-fullscreen {
  flex: 1;
  max-height: none;
  padding: 16px 24px;
  font-size: 15px;
}
.editor-content:empty::before {
  content: attr(data-placeholder);
  color: #ccc;
  pointer-events: none;
}
.editor-content:focus {
  background: #fafafa;
}
:deep(ul), :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}
</style>
