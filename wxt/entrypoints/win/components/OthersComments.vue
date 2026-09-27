<script setup>
// 他人笔记列表（商品/供应商共用）
// 数据由 localapi 按「他人笔记」开关裁剪：未连接或关闭时返回空数组
import { ref, watch } from 'vue'
import { api } from '@/utils/dataClient.js'

const props = defineProps({
  kind: { type: String, required: true }, // 'product' | 'supplier'
  target: { type: [String, Number], required: true },
})

const list = ref([])
const loaded = ref(false)

async function load() {
  const path = props.kind === 'product'
    ? `/api/v1/products/${encodeURIComponent(props.target)}/others`
    : `/api/v1/suppliers/others?supplier_name=${encodeURIComponent(props.target)}`
  const res = await api(path)
  list.value = res.code === 200 ? (res.data.comments || []) : []
  loaded.value = true
}

watch(() => props.target, load, { immediate: true })

const AVATAR_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
function avatarColor(name) {
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function fmtTime(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="others-comments">
    <div v-if="list.length" class="oc-title">团队成员笔记 · {{ list.length }}</div>
    <div v-if="!list.length && loaded" class="oc-empty">暂无团队成员笔记</div>

    <div v-for="c in list" :key="c.id" class="oc-item">
      <span class="oc-avatar" :style="{ background: avatarColor(c.nickname) }">
        {{ (c.nickname || '?').slice(0, 1) }}
      </span>
      <div class="oc-body">
        <div class="oc-meta">
          <span class="oc-name">{{ c.nickname || '匿名' }}</span>
          <span class="oc-time">{{ fmtTime(c.updated_at || c.created_at) }}</span>
        </div>
        <div class="oc-text" v-html="c.text"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.others-comments {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.oc-title {
  font-size: 12px;
  color: #888;
  margin: 10px 0 6px;
}
.oc-empty {
  font-size: 12px;
  color: #bbb;
  padding: 8px 0;
}
.oc-item {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid #f0f0f0;
}
.oc-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.oc-body {
  flex: 1;
  min-width: 0;
}
.oc-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 2px;
}
.oc-name {
  font-size: 12px;
  color: #333;
  font-weight: 600;
}
.oc-time {
  font-size: 11px;
  color: #bbb;
}
.oc-text {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  word-break: break-all;
}
.oc-text :deep(p) {
  margin: 0;
}
.oc-text :deep(img) {
  max-width: 100%;
}
</style>
