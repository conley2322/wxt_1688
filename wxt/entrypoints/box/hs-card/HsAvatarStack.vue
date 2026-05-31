<template>
  <div class="hs-avatar-bar">
    <div v-for="(v, i) in viewers.slice(0, maxShow)" :key="i" class="hs-avatar"
      :class="{ 'hs-avatar--coop': variant === 'supplier' }"
      :style="getAvatarStyle(i)"
      :title="v.tooltip">{{ v.initial }}</div>
    <span v-if="viewers.length > maxShow" class="hs-avatar-more">+{{ viewers.length - maxShow }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  viewers: { type: Array, default: () => [] },
  maxShow: { type: Number, default: 3 },
  variant: { type: String, default: 'product' }
})

const colorPool = ['#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']

function getAvatarStyle(i) {
  const base = { zIndex: props.viewers.length - i }
  if (props.variant === 'product') {
    base.background = colorPool[i % colorPool.length]
  }
  return base
}
</script>

<style scoped>
.hs-avatar-bar {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
  padding-right: 2px;
}

.hs-avatar-bar .hs-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  border: 1.5px solid #fff;
  cursor: default;
  transition: transform 0.15s;
}

.hs-avatar-bar .hs-avatar:hover {
  transform: scale(1.1);
  z-index: 100 !important;
}

.hs-avatar-bar .hs-avatar:not(:first-child) {
  margin-left: -5px;
}

.hs-avatar--coop {
  background: #ff6a00 !important;
  border: 1.5px solid #ff6a00;
  box-shadow: 0 0 0 1px #fff;
}

.hs-avatar-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f0f0f0;
  color: #999;
  font-size: 8px;
  font-weight: 500;
  border: 1.5px solid #fff;
  margin-left: -5px;
  flex-shrink: 0;
}
</style>
