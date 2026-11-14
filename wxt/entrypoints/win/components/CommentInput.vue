<template>
  <div ref="rootEl" class="rich-editor-wrap" :class="{ fullscreen: isFullscreen }">
    <div class="editor-header">
      <div v-if="showToolbar" id="_toolbar_normal" class="toolbar-container" :style="{ display: isFullscreen ? 'none' : '' }"></div>
      <div v-if="showToolbar" id="_toolbar_full" class="toolbar-container" :style="{ display: isFullscreen ? '' : 'none' }"></div>
      <span v-if="statusText" class="save-status" :class="status">{{ statusText }}</span>
      <button
        class="action-btn save-btn"
        :class="{ dirty: dirty && status !== 'saving' }"
        :title="dirty ? '保存修改（⌘/Ctrl+S）' : '保存（当前没有修改）'"
        @click="doSave"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        <span>保存</span>
      </button>
      <button v-if="canFullscreen && !hideFullscreen" class="action-btn fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏编辑'">
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
  showToolbar: { type: Boolean, default: true }, // 找工厂卡片里隐藏工具栏（空间太小）
  memberId: { type: String, default: '' }, // 供应商 memberId，与名字共同作为备注的稳定键
  repOfferId: { type: String, default: '' }, // 找工厂卡的代表商品 offerId（后端反查公司名当别名）
  hideFullscreen: { type: Boolean, default: false }, // 宿主自管全屏（找工厂卡全屏覆盖层内嵌时隐藏自带全屏按钮）
})

// 保存成功后抛给宿主（找工厂卡用它刷新统计）；win 页面不监听也不受影响
const emit = defineEmits(['saved'])

let editor = null
let toolbarNormal = null
let toolbarFull = null
const rootEl = ref(null)
const isFullscreen = ref(false)
const canFullscreen = ref(true)

// 自动保存状态：'' | saving | saved | error
const status = ref('')
const statusText = ref('')
// 是否有未保存修改：改为手动保存后，由它驱动保存按钮的可用/高亮状态
const dirty = ref(false)
let ready = false
let suppress = false
let lastEditAt = 0
let refreshFromStore = null
let onCommentChanged = null
let onKeySave = null
let pollTimer = null

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

// 找工厂卡带上代表商品 offerId：后端据此反查公司名当别名，与详情页写的那条对齐
function repQuery() {
  return props.kind !== 'product' && props.repOfferId ? '&rep_offer=' + encodeURIComponent(props.repOfferId) : ''
}
function memberQuery() {
  return props.kind !== 'product' && props.memberId ? '&member_id=' + encodeURIComponent(props.memberId) : ''
}
// 评论读取/自动保存路径
function loadPath() {
  return props.kind === 'product'
    ? `/api/v1/products/${props.target}/comments`
    : `/api/v1/suppliers/comments?supplier_name=${encodeURIComponent(props.target)}${memberQuery()}${repQuery()}`
}
function autoPath() {
  return props.kind === 'product'
    ? `/api/v1/products/${props.target}/comments/auto`
    : `/api/v1/suppliers/comments/auto?supplier_name=${encodeURIComponent(props.target)}${memberQuery()}${repQuery()}`
}

// 手动保存：改完点「保存」或按 ⌘/Ctrl+S 才落盘。
// 之前自动保存的体验不好（打字时一直在存、失败也无感），改为显式触发。
function setStatus(s) {
  status.value = s
  statusText.value = s === 'saving' ? '保存中…' : s === 'saved' ? '已保存' : s === 'error' ? '保存失败，可重试' : ''
}

async function doSave() {
  if (!editor) return
  const html = editor.getHtml()
  setStatus('saving')
  try {
    const res = await api(autoPath(), 'PUT', { text: html, member_id: props.memberId || '', rep_offer: props.repOfferId || '' })
    if (res.code === 200) {
      dirty.value = false
      setStatus('saved')
      emit('saved')
      setTimeout(() => { if (statusText.value === '已保存') setStatus('') }, 2000)
    } else {
      setStatus('error')
    }
  } catch {
    setStatus('error')
  }
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

  // 创建编辑器。注意：选择器一律在自己根节点内查元素后传「元素对象」——
  // 不能传字符串，wangEditor 内部用全局 document.querySelector，
  // 跨文档场景（如 IM 页面板挂在同源 iframe 里）会查错文档导致编辑器挂不上
  const containerEl = rootEl.value?.querySelector('#_editor_container')
  const tbNormalEl = rootEl.value?.querySelector('#_toolbar_normal')
  const tbFullEl = rootEl.value?.querySelector('#_toolbar_full')
  editor = createEditor({
    selector: containerEl,
    html: '<p><br></p>',
    config: {
      placeholder: props.placeholder,
      hoverbarKeys: {},
      onChange() {
        if (!ready || suppress || !editor) return
        // 手动保存：只标记“有未保存修改”，不自动落库
        lastEditAt = Date.now()
        if (!dirty.value) {
          dirty.value = true
          setStatus('')
        }
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

  toolbarNormal = props.showToolbar ? createToolbar({
    editor, selector: tbNormalEl,
    config: { toolbarKeys: normalKeys }, mode: 'simple',
  }) : null
  toolbarFull = props.showToolbar ? createToolbar({
    editor, selector: tbFullEl,
    config: { toolbarKeys: FULL_TOOLBAR }, mode: 'simple',
  }) : null

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

  // ── 跨窗口同步 ──
  // 找工厂页与商品详情浮窗是两个 content script，在一边改完另一边（未刷新）也要同步上屏。
  // 不能用 editor.isFocused() 判断——切标签页回来时焦点往往还“停”在编辑器上，会永远不刷新；
  // 改用「最近 2 秒内是否主动输入」判断，既能同步又不会冲掉正在打的字。
  refreshFromStore = async () => {
    if (!editor) return
    if (dirty.value) return // 有未保存修改时不能拿库里的旧内容盖掉
    if (Date.now() - lastEditAt < 2000) return
    try {
      const res = await api(loadPath(), 'GET')
      const list = res.code === 200 && Array.isArray(res.data) ? res.data : []
      const remote = (list[0] && list[0].text) || ''
      const cur = editor.getHtml()
      const norm = s => String(s || '').replace(/\s/g, '')
      if (norm(remote) === norm(cur)) return
      suppress = true
      editor.setHtml(remote || '<p><br></p>')
      suppress = false
      status.value = 'saved'
      statusText.value = '已同步'
      setTimeout(() => { if (statusText.value === '已同步') statusText.value = '' }, 1500)
    } catch {}
  }

  // 另一侧保存后会写一个 storage 信号（background 的 runtime.sendMessage 到不了 content script）
  onCommentChanged = (changes) => {
    const c = changes && changes.__commentChanged && changes.__commentChanged.newValue
    if (!c || c.kind !== props.kind) return
    const sameMember = !!(c.memberId && props.memberId && c.memberId === props.memberId)
    const a = String(c.target || ''), b = String(props.target || '')
    const sameName = !!(a && b && (a === b || a.includes(b) || b.includes(a)))
    if (!sameMember && !sameName) return
    refreshFromStore()
  }
  window.addEventListener('focus', refreshFromStore)
  document.addEventListener('visibilitychange', refreshFromStore)
  try { if (typeof browser !== 'undefined') browser.storage.onChanged.addListener(onCommentChanged) } catch {}

  // 兜底轮询：个别内嵌 iframe 收不到 onChanged 时，靠信号时间戳自己刷
  let lastSignalTs = 0
  pollTimer = setInterval(async () => {
    try {
      const s = await browser.storage.local.get('__commentChanged')
      const c = s && s.__commentChanged
      if (!c || !c.ts || c.ts === lastSignalTs) return
      lastSignalTs = c.ts
      if (onCommentChanged) onCommentChanged({ __commentChanged: { newValue: c } })
    } catch {}
  }, 2500)

  // ⌘/Ctrl+S 快捷保存（编辑器内输入时也能直接存）
  onKeySave = (e) => {
    if (!(e.metaKey || e.ctrlKey) || String(e.key).toLowerCase() !== 's') return
    // 只处理焦点落在本编辑器内的（找工厂页同时挂着多个编辑器）
    const t = e.target
    if (!rootEl.value || !(t instanceof Node) || !rootEl.value.contains(t)) return
    e.preventDefault()
    if (dirty.value) doSave()
  }
  window.addEventListener('keydown', onKeySave, true)
})

onBeforeUnmount(() => {
  if (onKeySave) window.removeEventListener('keydown', onKeySave, true)
  if (refreshFromStore) {
    window.removeEventListener('focus', refreshFromStore)
    document.removeEventListener('visibilitychange', refreshFromStore)
  }
  if (onCommentChanged) {
    try { browser.storage.onChanged.removeListener(onCommentChanged) } catch {}
  }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
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
/* 手动保存按钮：无修改时置灰不可点，有未保存内容时变成主色提醒 */
.save-btn { gap: 3px; height: 24px; padding: 0 8px; font-size: 11px; flex-shrink: 0;
  background: #f5f5f5; border: 1px solid #e5e5e5; color: #888; transition: all .15s; }
.save-btn:hover:not(:disabled) { background: #efefef; }
.save-btn.dirty { background: #c9975c; border-color: #c9975c; color: #fff; }
.save-btn.dirty:hover { background: #bb8a4f; }
.save-btn:active { transform: translateY(1px); }
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
