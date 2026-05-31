<template>
  <!-- 完整窗口模式 -->
  <div
    v-if="!isDotMode"
    class="draggable-window"
    ref="windowRef"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: windowSize.width + 'px',
      height: windowSize.height + 'px',
      cursor,
    }"
    @mousemove="handleMouseMove"
    @mouseleave="resetCursor"
  >
    <div class="window-title" @mousedown="startDrag">
      <div class="window-title-left">
        <slot name="title-prefix" />
        <span class="window-title-text">{{ title }}</span>
      </div>
      <div class="window-controls">
        <button class="control-btn minimize-btn" @mousedown.stop @click="minimize" title="最小化">
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
    ref="windowRef"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @mousedown="startDrag"
    @dblclick="restore"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  </div>
</template>

<script setup>
import { useWindowDrag } from './composables/useWindowDrag'

const props = defineProps({
  title:          { type: String,  default: '窗口' },
  initialX:       { type: Number,  default: 100 },
  initialY:       { type: Number,  default: 100 },
  initialWidth:   { type: Number,  default: 400 },
  initialHeight:  { type: Number,  default: 700 },
  minWidth:       { type: Number,  default: 300 },
  minHeight:      { type: Number,  default: 500 },
})

defineEmits(['close'])

const {
  windowRef,
  position,
  windowSize,
  isDotMode,
  cursor,
  startDrag,
  startResize,
  handleMouseMove,
  resetCursor,
  minimize,
  restore,
} = useWindowDrag(props)
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
.minimize-btn:hover { background: #f5f5f5; color: #333; }
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
