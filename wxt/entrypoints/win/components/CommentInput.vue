<template>
  <div class="rich-editor-wrap" :class="{ fullscreen: isFullscreen }">
    <div class="editor-header">
      <div class="editor-avatar" :style="{ background: userColor }">{{ userInitial }}</div>
      <div id="_toolbar_normal" class="toolbar-container" :style="{ display: isFullscreen ? 'none' : '' }"></div>
      <div id="_toolbar_full" class="toolbar-container" :style="{ display: isFullscreen ? '' : 'none' }"></div>
      <div class="editor-actions">
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
        <button class="action-btn send-btn" :disabled="isEmpty" @click="submit">{{ sendLabel }}</button>
      </div>
    </div>
    <div id="_editor_container" class="editor-container" :class="{ 'is-fullscreen': isFullscreen }" spellcheck="false"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { createEditor, createToolbar } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'

const props = defineProps({
  userInitial: { type: String, default: 'C' },
  userColor: { type: String, default: '#ff6a00' },
  placeholder: { type: String, default: '写点什么...' },
  sendLabel: { type: String, default: '评论' },
})

const emit = defineEmits(['send', 'update:text'])

let editor = null
let toolbarNormal = null
let toolbarFull = null
const isEmpty = ref(true)
const isFullscreen = ref(false)
const canFullscreen = ref(true)
let pendingContent = null // 编辑器就绪前暂存的内容
const urlMap = new Map() // blobUrl → serverUrl 映射，提交时替换

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

let normalKeys = ['bold', 'italic', 'underline', '|', 'bulletedList', 'numberedList']

function makeNormalKeys(cfg) {
  if (!cfg) return ['bold', 'italic', 'underline', '|', 'bulletedList', 'numberedList']
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
        if (!editor) return
        const html = editor.getHtml()
        const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
        const hasImage = /<img[^>]+src=/.test(html)
        isEmpty.value = !text && !hasImage
        emit('update:text', html)
      },
      MENU_CONF: {
        uploadImage: {
          async customUpload(file, insertFn) {
            console.log('[CommentInput upload] 文件大小:', file.size, '文件名:', file.name)
            const reader = new FileReader()
            reader.onload = async (e) => {
              if (file.size < 10 * 1024) {
                console.log('[CommentInput upload] <10KB, 使用 base64')
                insertFn(e.target.result, file.name)
                return
              }
              console.log('[CommentInput upload] >=10KB, 上传服务器')
              try {
                const stored = await browser.storage.local.get(['token', 'serverAddress'])
                console.log('[CommentInput upload] serverAddress:', stored.serverAddress)
                if (!stored.token) { console.log('[CommentInput upload] 无 token, fallback base64'); insertFn(e.target.result, file.name); return }
                const uploadUrl = `${stored.serverAddress}/api/v1/upload/image`
                console.log('[CommentInput upload] POST via background:', uploadUrl)
                
                // 通过 background 代理请求（绕过混合内容限制）
                const response = await browser.runtime.sendMessage({
                  type: 'api-request',
                  url: uploadUrl,
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${stored.token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ image: e.target.result, fileName: file.name })
                })

                console.log('[CommentInput upload] 响应:', response)
                if (response?.ok && response.data?.code === 200 && response.data.data?.url) {
                  const fullUrl = stored.serverAddress + response.data.data.url
                  console.log('[CommentInput upload] 服务器 URL:', fullUrl)
                  try {
                    // 通过 background 代理 fetch 图片
                    const imgResponse = await browser.runtime.sendMessage({
                      type: 'api-request',
                      url: fullUrl,
                      method: 'GET'
                    })
                    // 直接使用服务器 URL，background 已绕过限制
                    urlMap.set(fullUrl, fullUrl)
                    insertFn(fullUrl, file.name)
                  } catch (err) {
                    console.error('[CommentInput upload] 图片获取失败:', err)
                    insertFn(fullUrl, file.name)
                  }
                } else {
                  console.log('[CommentInput upload] 上传失败, fallback base64')
                  insertFn(e.target.result, file.name)
                }
              } catch (err) {
                console.error('[CommentInput upload] 异常:', err)
                insertFn(e.target.result, file.name)
              }
            }
            reader.readAsDataURL(file)
          },
        },
      },
    },
    mode: 'simple',
  })

  // 创建两个工具栏（始终保持）
  toolbarNormal = createToolbar({
    editor, selector: '#_toolbar_normal',
    config: { toolbarKeys: normalKeys }, mode: 'simple',
  })
  toolbarFull = createToolbar({
    editor, selector: '#_toolbar_full',
    config: { toolbarKeys: FULL_TOOLBAR }, mode: 'simple',
  })

  // 禁用选中弹出菜单
  try { editor.disableHoverbar() } catch {}

  // 应用暂存的内容（编辑时 setText 可能在编辑器就绪前调用）
  if (pendingContent) {
    try { editor.setHtml(pendingContent) } catch {}
    pendingContent = null
  }
})

onBeforeUnmount(() => {
  try { toolbarNormal?.destroy() } catch {}
  try { toolbarFull?.destroy() } catch {}
  try { editor?.destroy() } catch {}
})

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => editor?.focus())
}

function setText(content) {
  pendingContent = content
  try {
    if (editor) {
      editor.setHtml(content || '<p><br></p>')
      pendingContent = null
    }
  } catch {}
}

function submit() {
  try {
    let html = editor?.getHtml() || ''
    // 将 blob URL 替换回服务器 URL，保证存到数据库的是可持久化的 URL
    for (const [blobUrl, serverUrl] of urlMap) {
      html = html.replaceAll(blobUrl, serverUrl)
    }
    console.log('[CommentInput submit] HTML 长度:', html.length, '含uploads:', /\/uploads\//.test(html))
    const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    const hasImage = /<img[^>]+src=/.test(html)
    if (!text && !hasImage) return
    emit('send', html)
    urlMap.clear()
    editor?.setHtml('<p><br></p>')
  } catch {}
}

defineExpose({ setText, toggleFullscreen })
</script>

<style scoped>
.rich-editor-wrap {
  border-top: 1px solid #f0f0f0; background: #fff; flex-shrink: 0;
}
.rich-editor-wrap.fullscreen {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647; display: flex; flex-direction: column;
}
.editor-header { display: flex; align-items: center; gap: 6px; padding: 6px 12px; flex-shrink: 0; }
.editor-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 11px; font-weight: 600; flex-shrink: 0;
}
.toolbar-container { flex: 1; min-width: 0; }
.editor-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.action-btn { border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.fullscreen-btn { width: 28px; height: 28px; background: transparent; color: #999; }
.fullscreen-btn:hover { background: #f0f0f0; color: #333; }
.send-btn { background: #1677ff; color: #fff; font-size: 12px; padding: 5px 14px; font-weight: 500; }
.send-btn:disabled { background: #ccc; cursor: not-allowed; }
.editor-container { min-height: 60px; max-height: 200px; overflow-y: auto; }
.editor-container.is-fullscreen { flex: 1; max-height: none; }

:deep(.w-e-toolbar) { border: none !important; border-bottom: 1px solid #f0f0f0 !important; border-radius: 0 !important; }
:deep(.w-e-text-container) { border: none !important; border-radius: 0 !important; }
:deep(.w-e-text-container [data-slate-editor]) { min-height: 40px; padding: 8px 12px; font-size: 13px; line-height: 1.6; }
:deep(.w-e-bar-item button) { width: 28px; height: 28px; }
:deep(.w-e-bar-item button svg) { width: 14px; height: 14px; }
:deep(.w-e-bar) { padding: 2px 4px; }
:deep(.w-e-text-placeholder) { top: 10px; left: 12px; font-size: 13px; color: #ccc; }
:deep(.w-e-modal) { z-index: 2147483648; }
</style>
