<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  }
})

// SQLite 存的是本地时间字符串 "YYYY-MM-DD HH:mm:ss"
function formatDateTime(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(s)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="timeline">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="timeline-item"
      :style="{ animationDelay: `${index * 0.08}s` }"
    >
      <div class="timeline-dot-wrap">
        <div :class="['timeline-dot', item.status]"></div>
      </div>
      <div class="timeline-card">
        <div class="timeline-card-header">
          <div class="timeline-version">
            <span class="timeline-version-num">v{{ item.version }}</span>{{ item.title }}
            <span v-if="index === 0" class="latest-tag">最新版本</span>
          </div>
          <span :class="['timeline-status', item.status]">
            {{ item.status === 'published' ? '已发布' : '草稿' }}
          </span>
        </div>
        <div class="timeline-content" v-html="item.content"></div>
        <div class="timeline-card-footer">
          <span class="timeline-author">{{ item.created_by || '佚名' }}</span>
          发布于 {{ formatDateTime(item.created_at) }}
          <span v-if="item.updated_by" class="timeline-updated">
            · {{ item.updated_by }} 编辑于 {{ formatDateTime(item.updated_at) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  position: relative;
  padding-left: 0;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 27px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: #e5e7eb;
  border-radius: 1px;
}

.timeline-item {
  display: flex;
  gap: 16px;
  padding: 6px 0;
  position: relative;
  animation: fadeInUp 0.4s ease backwards;
}

.timeline-item:not(:last-child) {
  margin-bottom: 6px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.timeline-dot-wrap {
  flex-shrink: 0;
  width: 56px;
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.timeline-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid;
  background: #ffffff;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.timeline-dot.published {
  border-color: #10b981;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(16,185,129,0.12);
}

.timeline-dot.draft {
  border-color: #f59e0b;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(245,158,11,0.12);
}

.timeline-card {
  flex: 1;
  background: #ffffff;
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.04);
  border: 1px solid #e5e7eb;
  transition: box-shadow 250ms ease;
}

.timeline-card:hover {
  box-shadow: 0 4px 10px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.05);
}

.timeline-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.timeline-version {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: -0.2px;
}

.timeline-version-num {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
  margin-right: 4px;
}

.latest-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  padding: 2px 8px;
  border-radius: 100px;
  margin-left: 8px;
  vertical-align: middle;
  letter-spacing: 0.3px;
}

.timeline-status {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 100px;
  flex-shrink: 0;
  letter-spacing: 0.2px;
}

.timeline-status.published {
  color: #10b981;
  background: #d1fae5;
}

.timeline-status.draft {
  color: #f59e0b;
  background: #fef3c7;
}

.timeline-content {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.8;
}

.timeline-content ul {
  list-style: none;
  padding: 0;
}

.timeline-content li {
  position: relative;
  padding-left: 16px;
  margin-bottom: 4px;
}

.timeline-content li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d1d5db;
}

.timeline-card-footer {
  margin-top: 12px;
  font-size: 12px;
  color: #9ca3af;
}

.timeline-author {
  color: #4b5563;
  font-weight: 600;
}

.timeline-updated {
  color: #9ca3af;
}
</style>
