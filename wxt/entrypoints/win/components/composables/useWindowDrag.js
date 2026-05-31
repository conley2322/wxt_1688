import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 可拖拽/缩放窗口的行为逻辑
 *
 * 统一管理：位置、尺寸、拖拽、缩放、小圆标模式、光标样式、持久化。
 * 组件只负责模板渲染。
 *
 * @param {Object} options
 * @param {number} options.initialX       初始 X 坐标
 * @param {number} options.initialY       初始 Y 坐标
 * @param {number} options.initialWidth   初始宽度
 * @param {number} options.initialHeight  初始高度
 * @param {number} options.minWidth       最小宽度
 * @param {number} options.minHeight      最小高度
 * @param {number} [options.dotSize=40]   小圆标尺寸
 */
export function useWindowDrag(options) {
  const {
    initialX = 100,
    initialY = 100,
    initialWidth = 400,
    initialHeight = 700,
    minWidth = 300,
    minHeight = 500,
    dotSize = 40,
  } = options

  // ── 状态 ──────────────────────────────────────────────
  const windowRef = ref(null)
  const position = ref({ x: initialX, y: initialY })
  const windowSize = ref({ width: initialWidth, height: initialHeight })
  const isDotMode = ref(false)
  const isDragging = ref(false)
  const isResizing = ref(false)
  const resizeDirection = ref('')
  const cursor = ref('default')

  // ── 内部临时状态 ──────────────────────────────────────
  const dragOffset = ref({ x: 0, y: 0 })
  const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

  // ── 拖拽 ─────────────────────────────────────────────
  function onDrag(e) {
    const w = isDotMode.value ? dotSize : windowSize.value.width
    const h = isDotMode.value ? dotSize : windowSize.value.height
    position.value = {
      x: Math.max(0, Math.min(e.clientX - dragOffset.value.x, window.innerWidth - w)),
      y: Math.max(0, Math.min(e.clientY - dragOffset.value.y, window.innerHeight - h)),
    }
  }

  function stopDrag() {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    savePosition()
  }

  function startDrag(e) {
    if (!windowRef.value || isResizing.value) return
    isDragging.value = true
    dragOffset.value = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    e.preventDefault()
  }

  // ── 缩放 ─────────────────────────────────────────────
  function onResize(e) {
    const dx = e.clientX - resizeStart.value.x
    const dy = e.clientY - resizeStart.value.y
    let newWidth = resizeStart.value.width
    let newHeight = resizeStart.value.height

    if (resizeDirection.value === 'right' || resizeDirection.value === 'bottom-right') {
      newWidth = Math.max(minWidth, Math.min(resizeStart.value.width + dx, window.innerWidth - position.value.x))
    }
    if (resizeDirection.value === 'bottom' || resizeDirection.value === 'bottom-right') {
      newHeight = Math.max(minHeight, Math.min(resizeStart.value.height + dy, window.innerHeight - position.value.y))
    }
    windowSize.value = { width: newWidth, height: newHeight }
  }

  function stopResize() {
    isResizing.value = false
    resizeDirection.value = ''
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
    savePosition()
  }

  function startResize(direction, e) {
    if (!windowRef.value) return
    isResizing.value = true
    resizeDirection.value = direction
    resizeStart.value = {
      x: e.clientX,
      y: e.clientY,
      width: windowSize.value.width,
      height: windowSize.value.height,
    }
    document.addEventListener('mousemove', onResize)
    document.addEventListener('mouseup', stopResize)
    e.preventDefault()
  }

  // ── 光标样式 ─────────────────────────────────────────
  function handleMouseMove(e) {
    if (isDragging.value || isResizing.value || !windowRef.value) return
    if (isDotMode.value) { cursor.value = 'move'; return }

    const rect = windowRef.value.getBoundingClientRect()
    const edge = 8
    const isR = e.clientX >= rect.right - edge
    const isB = e.clientY >= rect.bottom - edge

    if (isR && isB) cursor.value = 'se-resize'
    else if (isR) cursor.value = 'e-resize'
    else if (isB) cursor.value = 's-resize'
    else if (e.target.closest('.window-title')) cursor.value = 'move'
    else cursor.value = 'default'
  }

  function resetCursor() {
    cursor.value = isDotMode.value ? 'move' : 'default'
  }

  // ── 小圆标模式 ───────────────────────────────────────
  function minimize() {
    isDotMode.value = true
    windowSize.value = { width: dotSize, height: dotSize }
  }

  function restore() {
    isDotMode.value = false
    windowSize.value = { width: initialWidth, height: initialHeight }
  }

  // ── 持久化 ───────────────────────────────────────────
  async function restorePosition() {
    const stored = await browser.storage.local.get(['winPosition', 'winSize', 'winDotMode'])
    if (stored.winPosition) position.value = stored.winPosition
    if (stored.winDotMode === true) {
      isDotMode.value = true
      windowSize.value = { width: dotSize, height: dotSize }
    } else if (stored.winSize) {
      windowSize.value = stored.winSize
    }
  }

  async function savePosition() {
    if (isDotMode.value) return
    await browser.storage.local.set({
      winPosition: position.value,
      winSize: windowSize.value,
      winDotMode: false,
    })
  }

  // ── 生命周期 ─────────────────────────────────────────
  onMounted(restorePosition)
  onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
  })

  // ── 暴露接口 ─────────────────────────────────────────
  return {
    // refs
    windowRef,
    position,
    windowSize,
    isDotMode,
    cursor,
    // 拖拽
    startDrag,
    // 缩放
    startResize,
    // 光标
    handleMouseMove,
    resetCursor,
    // 小圆标
    minimize,
    restore,
  }
}
