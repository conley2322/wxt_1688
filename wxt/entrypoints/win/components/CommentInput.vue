<template>
  <div class="rich-editor-wrap" :class="{ fullscreen: isFullscreen }">
    <div class="editor-header">
      <div id="_toolbar_normal" class="toolbar-container" :style="{ display: isFullscreen ? 'none' : '' }"></div>
      <div id="_toolbar_full" class="toolbar-container" :style="{ display: isFullscreen ? '' : 'none' }"></div>
      <span v-if="statusText" class="save-status" :class="status">{{ statusText }}</span>
      <button v-if="canFullscreen" class="action-btn fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏编辑'">
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
    </div>
    <div id="_editor_container" class="editor-container" :class="{ 'is-fullscreen': isFullscreen }" spellcheck="false"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { createEditor, createToolbar } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import { api } from '@/utils/dataClient.js'

const props = defineProps({
  kind: { type: String, required: true }, // product / supplier
  target: { type: String, required: true }, // 商品 offer_id 或供应商名称
  placeholder: { type: String, default: '写点什么，编辑后自动保存...' },
})

let editor = null
let toolbarNormal = null
let toolbarFull = null
const isFullscreen = ref(false)
const canFullscreen = ref(true)

// 自动保存状态：'' | saving | saved | error
const status = ref('')
const statusText = ref('')
let ready = false
let suppress = false
let saveTimer = null

const FULL_TOOLBAR = [
  'headerSelect', '|',
  'bold', 'italic', 'underline', 'through', '|',
  'color', 'bgColor', '|',
  'fontSize', 'fontFamily', '|',
  'bulletedList', 'numberedList', 'todo', '|',
  'blockquote', 'codeBlock', '|',
  'insertLink', 'insertImage', 'insertTable', '|',
  'undo', 'redo', 'clearStyle',
]

let normalKeys = ['bold', 'italic', '|', 'insertImage']

function makeNormalKeys(cfg) {
  if (!cfg) return ['bold', 'italic', '|', 'insertImage']
  const keys = []
  if (cfg.bold) keys.push('bold')
  if (cfg.italic) keys.push('italic')
  if (cfg.underline) keys.push('underline')
  if (cfg.strikethrough) keys.push('through')
  if (cfg.heading) keys.push('headerSelect')
  if (keys.length) keys.push('|')
  if (cfg.bulletList) keys.push('bulletedList')
  if (cfg.orderedList) keys.push('numberedList')
  if (cfg.blockquote) keys.push('blockquote')
  if (cfg.code) keys.push('codeBlock')
  if (cfg.link || cfg.image) keys.push('|')
  if (cfg.link) keys.push('insertLink')
  if (cfg.image) keys.push('insertImage')
  if (keys.length === 0) keys.push('bold')
  return keys
}

// 评论读取/自动保存路径
function loadPath() {
  return props.kind === 'product'
    ? `/api/v1/products/${props.target}/comments`
    : `/api/v1/suppliers/comments?supplier_name=${encodeURIComponent(props.target)}`
}
function autoPath() {
  return props.kind === 'product'
    ? `/api/v1/products/${props.target}/comments/auto`
    : `/api/v1/suppliers/comments/auto?supplier_name=${encodeURIComponent(props.target)}`
}

function setStatus(s) {
  status.value = s
  statusText.value = s === 'saving' ? '保存中…' : s === 'saved' ? '已自动保存' : s === 'error' ? '保存失败' : ''
}

async function doSave() {
  const html = editor.getHtml()
  setStatus('saving')
  const res = await api(autoPath(), 'PUT', { text: html })
  if (res.code === 200) {
    setStatus('saved')
  } else {
    setStatus('error')
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  setStatus('saving')
  saveTimer = setTimeout(doSave, 800)
}

onMounted(async () => {
  await nextTick()

  try {
    const stored = await browser.storage.local.get('toolbarConfig')
    if (stored.toolbarConfig) {
      normalKeys = makeNormalKeys(stored.toolbarConfig)
      if (stored.toolbarConfig.fullscreen !== false) canFullscreen.value = true
    }
  } catch {}

  // 创建编辑器
  editor = createEditor({
    selector: '#_editor_container',
    html: '<p><br></p>',
    config: {
      placeholder: props.placeholder,
      hoverbarKeys: {},
      onChange() {
        if (!ready || suppress || !editor) return
        scheduleSave()
      },
      MENU_CONF: {
        uploadImage: {
          // 单机版：图片直接以 base64 存入本地 IndexedDB，无服务器上传
          async customUpload(file, insertFn) {
            const reader = new FileReader()
            reader.onload = (e) => {
              insertFn(e.target.result, file.name)
            }
            reader.readAsDataURL(file)
          },
        },
      },
    },
    mode: 'simple',
  })

  toolbarNormal = createToolbar({
    editor, selector: '#_toolbar_normal',
    config: { toolbarKeys: normalKeys }, mode: 'simple',
  })
  toolbarFull = createToolbar({
    editor, selector: '#_toolbar_full',
    config: { toolbarKeys: FULL_TOOLBAR }, mode: 'simple',
  })

  try { editor.disableHoverbar() } catch {}

  // 加载已有评论内容（setHtml 会触发 onChange，用 suppress 屏蔽）
  try {
    const res = await api(loadPath(), 'GET')
    const list = res.code === 200 && Array.isArray(res.data) ? res.data : []
    const mine = list[0]
    if (mine && mine.text) {
      suppress = true
      editor.setHtml(mine.text)
      suppress = false
    }
  } catch {}

  ready = true
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    doSave() // 卸载前立即保存最后一次编辑
  }
  try { toolbarNormal?.destroy() } catch {}
  try { toolbarFull?.destroy() } catch {}
  try { editor?.destroy() } catch {}
})

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => editor?.focus())
}
</script>

<style scoped>
.rich-editor-wrap {
  background: #fff; display: flex; flex-direction: column;
  min-height: 0; flex: 1;
}
.rich-editor-wrap.fullscreen {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647; display: flex; flex-direction: column;
}
.editor-header { display: flex; align-items: center; gap: 6px; padding: 6px 12px; flex-shrink: 0; }
.toolbar-container { flex: 1; min-width: 0; }
.save-status { font-size: 11px; color: #999; flex-shrink: 0; }
.save-status.saved { color: #52c41a; }
.save-status.error { color: #ff4d4f; }
.save-status.saving { color: #1677ff; }
.action-btn { border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fullscreen-btn { width: 28px; height: 28px; background: transparent; color: #999; flex-shrink: 0; }
.fullscreen-btn:hover { background: #f0f0f0; color: #333; }
.editor-container { flex: 1; min-height: 120px; overflow-y: auto; }
.editor-container.is-fullscreen { flex: 1; }

:deep(.w-e-toolbar) { border: none !important; border-bottom: 1px solid #f0f0f0 !important; border-radius: 0 !important; }
:deep(.w-e-text-container) { border: none !important; border-radius: 0 !important; }
:deep(.w-e-text-container [data-slate-editor]) { min-height: 100px; padding: 8px 12px; font-size: 13px; line-height: 1.6; }
:deep(.w-e-bar-item button) { width: 28px; height: 28px; }
:deep(.w-e-bar-item button svg) { width: 14px; height: 14px; }
:deep(.w-e-bar) { padding: 2px 4px; }
:deep(.w-e-text-placeholder) { top: 10px; left: 12px; font-size: 13px; color: #ccc; }
:deep(.w-e-modal) { z-index: 2147483648; }
</style>
