<template>
  <div
    v-if="!isDotMode"
    class="draggable-window"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: windowSize.width + 'px',
      height: windowSize.height + 'px',
    }"
    ref="windowRef"
    @mousemove="handleMouseMove"
    @mouseleave="resetCursor"
  >
    <div class="window-title" @mousedown="startDrag">
      <div class="window-title-left">
        <slot name="title-prefix" />
        <span class="window-title-text">{{ title }}</span>
      </div>
      <div class="window-controls">
        <button class="control-btn close-btn" @click.stop="closeWindow" title="最小化">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M18 12H6" />
          </svg>
        </button>
      </div>
    </div>

    <div class="window-content">
      <slot />
    </div>

    <div class="resize-handle resize-handle-right" @mousedown="startResize('right', $event)" />
    <div class="resize-handle resize-handle-bottom" @mousedown="startResize('bottom', $event)" />
    <div class="resize-handle resize-handle-bottom-right" @mousedown="startResize('bottom-right', $event)" />
  </div>

  <!-- 小圆标模式 -->
  <div
    v-else
    class="dot-mode-window"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    ref="windowRef"
    @mousedown="startDrag"
    @dblclick="restoreFromDotMode"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  title: { type: String, default: '窗口' },
  initialX: { type: Number, default: 100 },
  initialY: { type: Number, default: 100 },
  initialWidth: { type: Number, default: 400 },
  initialHeight: { type: Number, default: 700 },
  minWidth: { type: Number, default: 300 },
  minHeight: { type: Number, default: 500 },
})

const emit = defineEmits(['close'])

const windowRef = ref(null)
const position = ref({ x: props.initialX, y: props.initialY })
const windowSize = ref({ width: props.initialWidth, height: props.initialHeight })
const isDragging = ref(false)
const isResizing = ref(false)
const isDotMode = ref(false)
const resizeDirection = ref('')
const dragOffset = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

const startDrag = (e) => {
  if (!windowRef.value || isResizing.value) return
  isDragging.value = true
  dragOffset.value = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

const drag = (e) => {
  if (!isDragging.value || !windowRef.value) return
  const w = isDotMode.value ? 40 : windowSize.value.width
  const h = isDotMode.value ? 40 : windowSize.value.height
  position.value = {
    x: Math.max(0, Math.min(e.clientX - dragOffset.value.x, window.innerWidth - w)),
    y: Math.max(0, Math.min(e.clientY - dragOffset.value.y, window.innerHeight - h)),
  }
}

const stopDrag = async () => {
  isDragging.value = false
  document.removeEventListener('mousemove', drag)
  document.removeEventListener('mouseup', stopDrag)
  await savePosition()
}

const startResize = (direction, e) => {
  if (!windowRef.value) return
  isResizing.value = true
  resizeDirection.value = direction
  resizeStart.value = { x: e.clientX, y: e.clientY, width: windowSize.value.width, height: windowSize.value.height }
  document.addEventListener('mousemove', resize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const resize = (e) => {
  if (!isResizing.value || !windowRef.value) return
  const dx = e.clientX - resizeStart.value.x
  const dy = e.clientY - resizeStart.value.y
  let newWidth = resizeStart.value.width
  let newHeight = resizeStart.value.height

  if (resizeDirection.value === 'right' || resizeDirection.value === 'bottom-right') {
    newWidth = Math.max(props.minWidth, Math.min(resizeStart.value.width + dx, window.innerWidth - position.value.x))
  }
  if (resizeDirection.value === 'bottom' || resizeDirection.value === 'bottom-right') {
    newHeight = Math.max(props.minHeight, Math.min(resizeStart.value.height + dy, window.innerHeight - position.value.y))
  }
  windowSize.value = { width: newWidth, height: newHeight }
}

const stopResize = async () => {
  isResizing.value = false
  resizeDirection.value = ''
  document.removeEventListener('mousemove', resize)
  document.removeEventListener('mouseup', stopResize)
  await savePosition()
}

const handleMouseMove = (e) => {
  if (!windowRef.value || isDragging.value || isResizing.value) return
  if (isDotMode.value) { windowRef.value.style.cursor = 'move'; return }

  const rect = windowRef.value.getBoundingClientRect()
  const edge = 8
  const isR = e.clientX >= rect.right - edge
  const isB = e.clientY >= rect.bottom - edge
  if (isR && isB) windowRef.value.style.cursor = 'se-resize'
  else if (isR) windowRef.value.style.cursor = 'e-resize'
  else if (isB) windowRef.value.style.cursor = 's-resize'
  else windowRef.value.style.cursor = e.target.closest('.window-title') ? 'move' : 'default'
}

const resetCursor = () => {
  if (!windowRef.value) return
  windowRef.value.style.cursor = isDotMode.value ? 'move' : 'default'
}

const closeWindow = () => {
  isDotMode.value = true
  windowSize.value = { width: 40, height: 40 }
}

const restoreFromDotMode = () => {
  isDotMode.value = false
  windowSize.value = { width: props.initialWidth, height: props.initialHeight }
}

async function restorePosition() {
  const stored = await browser.storage.local.get(['winPosition', 'winSize', 'winDotMode'])
  if (stored.winPosition) position.value = stored.winPosition
  if (stored.winDotMode === true) {
    isDotMode.value = true
    windowSize.value = { width: 40, height: 40 }
  } else if (stored.winSize) {
    windowSize.value = stored.winSize
  }
}

async function savePosition() {
  if (isDotMode.value) return
  await browser.storage.local.set({ winPosition: position.value, winSize: windowSize.value, winDotMode: false })
}

onMounted(restorePosition)
onUnmounted(() => {
  document.removeEventListener('mousemove', drag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('mousemove', resize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.draggable-window {
  position: fixed;
  z-index: 2147483647;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}
.dot-mode-window {
  position: fixed;
  z-index: 2147483647;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #eee;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  cursor: move;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}
.window-title {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 12px;
  cursor: move;
  user-select: none;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
}
.window-title-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.window-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.window-controls { display: flex; gap: 4px; }
.control-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #999;
  transition: all 0.15s;
}
.close-btn:hover { background: #f5f5f5; color: #333; }
.window-content {
  width: 100%;
  height: calc(100% - 36px);
  overflow: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.resize-handle { position: absolute; opacity: 1; }
.resize-handle-right { top: 0; right: 0; width: 8px; height: 100%; cursor: e-resize; }
.resize-handle-bottom { left: 0; bottom: 0; width: 100%; height: 8px; cursor: s-resize; }
.resize-handle-bottom-right { right: 0; bottom: 0; width: 16px; height: 16px; cursor: se-resize; }
</style>