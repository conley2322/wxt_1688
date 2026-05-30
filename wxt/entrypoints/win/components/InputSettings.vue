<template>
  <div class="input-settings">
    <div class="option-row">
      <span class="option-label">字体色：</span>
      <span
        v-for="c in fontColors"
        :key="c"
        class="color-dot"
        :style="{ background: c, border: fontColor === c ? '2px solid #333' : '2px solid transparent' }"
        @click="$emit('update:fontColor', c)"
      ></span>
    </div>
    <div class="option-row">
      <span class="option-label">背景色：</span>
      <span
        v-for="c in bgColors"
        :key="c"
        class="color-dot"
        :style="{ background: c, border: bgColor === c ? '2px solid #333' : '2px solid transparent' }"
        @click="$emit('update:bgColor', c)"
      ></span>
    </div>
    <div class="option-row">
      <span class="option-label">可见性：</span>
      <label class="radio-label">
        <input type="radio" value="public" :checked="visibility === 'public'" @change="$emit('update:visibility', 'public')" /> 公开
      </label>
      <label class="radio-label">
        <input type="radio" value="private" :checked="visibility === 'private'" @change="$emit('update:visibility', 'private')" /> 仅自己可见
      </label>
    </div>
  </div>
</template>

<script setup>
defineProps({
  fontColor: { type: String, default: '#fff' },
  bgColor: { type: String, default: '#2ecc71' },
  visibility: { type: String, default: 'public' },
})

defineEmits(['update:fontColor', 'update:bgColor', 'update:visibility'])

const fontColors = ['#fff', '#000', '#e74c3c', '#1677ff', '#2ecc71']
const bgColors = ['#2ecc71', '#1677ff', '#9b59b6', '#ff6a00', '#e74c3c', '#34495e']
</script>

<style scoped>
.input-settings {
  padding: 6px 12px 2px;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
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
  width: 18px;
  height: 18px;
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