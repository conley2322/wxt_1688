<script setup>
import { useApiStore } from '@/entrypoints/stores/api/api.js'
const store = useApiStore()
</script>

<template>
  <div class="analysis-records">
    <div v-for="(r, i) in store.viewRecords" :key="i" class="record-item">
      <div class="record-avatar" :style="{ background: r.color }">{{ r.initial }}</div>
      <div class="record-body">
        <span class="record-name">{{ r.user_name }}</span>
        <span class="record-time">{{ r.time }}</span>
      </div>
    </div>
    <div v-if="store.viewRecords.length === 0" class="empty">暂无浏览记录</div>
  </div>
</template>

<style scoped>
.analysis-records {
  padding: 4px 0;
}
.record-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}
.record-item + .record-item {
  border-top: 1px solid #f5f5f5;
}
.record-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}
.record-body {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.record-name {
  font-size: 13px;
  color: #333;
  font-weight: 500;
}
.record-time {
  font-size: 11px;
  color: #bbb;
}
.empty {
  text-align: center;
  color: #ccc;
  padding: 40px 0;
  font-size: 13px;
}
</style>