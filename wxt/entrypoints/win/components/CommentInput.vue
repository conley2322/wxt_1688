<template>
  <div class="comment-input-wrap">
    <div class="input-avatar" :style="{ background: userColor }">{{ userInitial }}</div>
    <div class="input-area">
      <input
        ref="inputRef"
        class="input-field"
        v-model="text"
        :placeholder="placeholder"
        @keydown.enter="submit"
      />
    </div>
    <button class="send-btn" :disabled="!text.trim()" @click="submit">发送</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  userInitial: { type: String, default: 'C' },
  userColor: { type: String, default: '#ff6a00' },
  placeholder: { type: String, default: '输入评论...' },
})

const emit = defineEmits(['send'])
const text = ref('')
const inputRef = ref(null)

function submit() {
  const t = text.value.trim()
  if (!t) return
  emit('send', t)
  text.value = ''
  inputRef.value?.focus()
}
</script>

<style scoped>
.comment-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}
.input-avatar {
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
.input-area {
  flex: 1;
}
.input-field {
  width: 100%;
  border: none;
  outline: none;
  font-size: 13px;
  color: #333;
  background: #f5f5f5;
  border-radius: 16px;
  padding: 7px 12px;
  box-sizing: border-box;
}
.input-field::placeholder {
  color: #ccc;
}
.send-btn {
  flex-shrink: 0;
  border: none;
  background: #1677ff;
  color: #fff;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}
.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.send-btn:not(:disabled):hover {
  background: #4096ff;
}
</style>