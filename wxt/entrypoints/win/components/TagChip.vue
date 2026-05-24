<template>
  <div class="tag-chip" :style="{ background: color }" @mouseenter="showActions = true" @mouseleave="showActions = false"
    @click.stop>
    <span class="tag-text">{{ text }}</span>

    <!-- 悬停操作浮层 -->
    <div v-if="showActions" class="tag-actions">
      <button class="tag-action-btn" @click.stop="$emit('toggle-visible')">
        {{ visible ? '🔓 团队可见' : '🔒 仅自己' }}
      </button>
      <button class="tag-action-btn" @click.stop="$emit('remove')">🗑 移除</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  color: { type: String, default: '#2ecc71' },
  visible: { type: Boolean, default: true },
})

const emit = defineEmits(['toggle-visible', 'remove'])

const showActions = ref(false)
</script>

<style scoped>
.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  color: #fff;
  cursor: pointer;
  position: relative;
  line-height: 20px;
}
.tag-text {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-actions {
  position: absolute;
  top: 100%;
  left: 0;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 10;
  display: flex;
  flex-direction: column;
  white-space: nowrap;
}
.tag-action-btn {
  border: none;
  background: none;
  padding: 6px 12px;
  font-size: 11px;
  cursor: pointer;
  color: #333;
  text-align: left;
}
.tag-action-btn:hover {
  background: #f5f5f5;
}
</style>