<template>
  <div class="rich-editor-wrap" :class="{ fullscreen: isFullscreen }">
    <div class="editor-header">
      <div class="editor-avatar" :style="{ background: userColor }">{{ userInitial }}</div>
      <div class="editor-actions">
        <button class="action-btn fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏编辑'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <template v-if="!isFullscreen">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </template>
            <template v-else>
              <polyline points="4 14 10 14 10 20"/>
              <polyline points="20 10 14 10 14 4"/>
              <line x1="14" y1="10" x2="21" y2="3"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </template>
          </svg>
        </button>
        <button class="action-btn send-btn" :disabled="isEmpty" @click="submit">
          {{ sendLabel }}
        </button>
      </div>
    </div>
    <div class="editor-container">
      <Toolbar
        v-if="editor"
        class="editor-toolbar"
        :editor="editor"
        :defaultConfig="toolbarConfig"
        mode="default"
      />
      <Editor
        class="editor-content"
        v-model="html"
        :defaultConfig="editorConfig"
        mode="default"
        @onCreated="onCreated"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onBeforeUnmount, watch } from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'

const props = defineProps({
  userInitial: { type: String, default: 'C' },
  userColor: { type: String, default: '#ff6a00' },
  placeholder: { type: String, default: '写点什么...' },
  sendLabel: { type: String, default: '评论' },
})

const emit = defineEmits(['send', 'update:text'])

const editor = shallowRef(null)
const html = ref('<p><br></p>')
const isFullscreen = ref(false)

const toolbarConfig = {
  toolbarKeys: [
    'headerSelect',
    'bold',
    'italic',
    'through',
    '|',
    'bulletedList',
    'numberedList',
    '|',
    'insertLink',
  ],
}

const editorConfig = {
  placeholder: props.placeholder,
  MENU_CONF: {},
}

const isEmpty = computed(() => {
  const text = html.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return !text || text === ''
})

watch(() => props.placeholder, (val) => {
  if (editor.value) {
    editor.value.getConfig().placeholder = val
  }
})

watch(html, (val) => {
  emit('update:text', val)
})

function onCreated(e) {
  editor.value = e
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  if (editor.value) {
    setTimeout(() => editor.value.focus(), 100)
  }
}

function setText(content) {
  if (editor.value) {
    editor.value.setHtml(content)
  }
}

function submit() {
  const content = html.value.trim()
  if (!content || content === '<p><br></p>') return
  emit('send', content)
  if (editor.value) {
    editor.value.setHtml('<p><br></p>')
  }
}

defineExpose({ setText, toggleFullscreen })

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
})
</script>

<style scoped>
.rich-editor-wrap {
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}
.rich-editor-wrap.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.rich-editor-wrap.fullscreen .editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.rich-editor-wrap.fullscreen .editor-content {
  flex: 1;
}
.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
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
.editor-container {
  border-top: 1px solid #f0f0f0;
}
.editor-toolbar {
  border-bottom: 1px solid #f0f0f0 !important;
}
.editor-content {
  min-height: 60px;
  max-height: 150px;
  overflow-y: auto;
}
.fullscreen .editor-content {
  max-height: none;
}
:deep(.w-e-text-container p) {
  margin: 4px 0;
}
</style>
