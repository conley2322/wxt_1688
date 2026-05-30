<template>
  <div class="tag-creator">
    <div class="creator-input-row">
      <input
        class="creator-input"
        v-model="tagText"
        placeholder="输入新标签名..."
        @keydown.enter="handleCreate"
        @focus="expanded = true"
      />
      <button class="creator-btn" :disabled="!tagText.trim()" @click="handleCreate">添加</button>
    </div>

    <div v-if="expanded" class="creator-options">
      <div class="option-row">
        <span class="option-label">字体色：</span>
        <span
          v-for="c in fontColors"
          :key="c"
          class="color-dot"
          :style="{ background: c, border: fontColor === c ? '2px solid #333' : '2px solid transparent' }"
          @click="fontColor = c"
        ></span>
      </div>
      <div class="option-row">
        <span class="option-label">背景色：</span>
        <span
          v-for="c in bgColors"
          :key="c"
          class="color-dot"
          :style="{ background: c, border: bgColor === c ? '2px solid #333' : '2px solid transparent' }"
          @click="bgColor = c"
        ></span>
      </div>
      <div class="option-row">
        <span class="option-label">可见性：</span>
        <label class="radio-label">
          <input type="radio" value="public" v-model="visibility" /> 公开
        </label>
        <label class="radio-label">
          <input type="radio" value="private" v-model="visibility" /> 仅自己可见
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['create'])

const tagText = ref('')
const fontColor = ref('#fff')
const bgColor = ref('#2ecc71')
const visibility = ref('public')
const expanded = ref(false)

const fontColors = ['#fff', '#000', '#e74c3c', '#1677ff', '#2ecc71']
const bgColors = ['#2ecc71', '#1677ff', '#9b59b6', '#ff6a00', '#e74c3c', '#34495e']

function handleCreate() {
  const text = tagText.value.trim()
  if (!text) return
  emit('create', {
    text,
    fontColor: fontColor.value,
    bgColor: bgColor.value,
    visibility: visibility.value,
  })
  tagText.value = ''
  fontColor.value = '#fff'
  bgColor.value = '#2ecc71'
  visibility.value = 'public'
}
</script>

<style scoped>
.tag-creator {
  padding: 6px 12px;
  border-top: 1px solid #f0f0f0;
}
.creator-input-row {
  display: flex;
  gap: 6px;
}
.creator-input {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
}
.creator-input:focus {
  border-color: #1677ff;
}
.creator-btn {
  border: none;
  background: #1677ff;
  color: #fff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.creator-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.creator-options {
  margin-top: 8px;
  padding: 8px;
  background: #fafafa;
  border-radius: 6px;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.option-row:last-child {
  margin-bottom: 0;
}
.option-label {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}
.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  box-sizing: border-box;
}
.radio-label {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 3px;
  margin-right: 8px;
}
</style>
