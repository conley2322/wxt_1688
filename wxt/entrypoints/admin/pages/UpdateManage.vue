<script setup>
import { ref, onMounted } from 'vue'
import { Calendar } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app.js'
import { api } from '../utils/useApi.js'
import UpdateTimeline from '../components/UpdateTimeline.vue'

const router = useRouter()
const appStore = useAppStore()
const isAdmin = ref(false)

const version = appStore.config.app.version
const productName = appStore.config.app.name
const producer = 'Conley'

const updates = ref([
  
])

onMounted(async () => {
  try {
    const stored = await browser.storage.local.get(['token', 'serverAddress', 'username'])
    if (stored.token) {
      const res = await fetch(`${stored.serverAddress}/api/v1/users`, {
        headers: { 'Authorization': `Bearer ${stored.token}` }
      })
      const data = await res.json()
      if (data.code === 200) {
        const me = data.data?.find(u => u.username === stored.username)
        isAdmin.value = me?.role === 'admin'
      }
    }
  } catch (e) {
    console.error('检查权限失败:', e)
  }
  
  try {
    const res = await api('/api/v1/updates', 'GET')
    if (res.code === 200 && res.data.length > 0) {
      updates.value = res.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
  } catch (e) {
    console.log('使用mock数据')
  }
})
</script>

<template>
  <section class="app-section">
    <!-- 产品信息卡片 -->
    <div class="product-card">
      <div class="product-card-logo">
        <img src="/logo.svg" alt="Logo" width="40" height="40" />
      </div>
      <div class="product-card-info">
        <div class="product-card-name">{{ productName }}</div>
        <div class="product-card-meta">
          <span>当前版本 v{{ version }}</span>
          <span class="meta-dot"></span>
          <span>制作人 {{ producer }}</span>
          <span class="meta-dot"></span>
          <span>共 {{ updates.length }} 个版本</span>
        </div>
      </div>
    </div>
    
    <!-- 版本更新时间线 -->
    <div class="section-header">
      <div class="section-title">
        <el-icon :size="18" class="section-icon"><Calendar /></el-icon>
        产品版本更新
        <span class="section-badge">{{ updates.length }} 条记录</span>
      </div>
      <button v-if="isAdmin" class="btn-primary" @click="router.push('/updates/publish')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        发布更新
      </button>
    </div>
    
    <UpdateTimeline :items="updates" />
  </section>
</template>

<style scoped>
/* CSS 变量作用域放到组件根节点，scoped 下 :root 不生效 */
.app-section {
  --brand-color: #3b82f6;
  --brand-hover: #2563eb;
  --brand-subtle: rgba(59,130,246,0.08);
  --ink-primary: #1f2937;
  --ink-secondary: #4b5563;
  --ink-tertiary: #9ca3af;
  --surface-bg: #f9fafb;
  --surface-card: #ffffff;
  --border-light: #e5e7eb;
  --border-medium: #d1d5db;
  --green: #10b981;
  --green-bg: #d1fae5;
  --amber: #f59e0b;
  --amber-bg: #fef3c7;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 10px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.05);
}

.app-section {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.product-card {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.product-card-logo {
  width: 64px;
  height: 64px;
  background: var(--brand-subtle);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.product-card-logo img {
  opacity: 0.85;
}

.product-card-info {
  flex: 1;
}

.product-card-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink-primary);
  margin-bottom: 6px;
  letter-spacing: -0.3px;
}

.product-card-meta {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: var(--ink-tertiary);
  align-items: center;
}

.meta-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(0,0,0,0.15);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: -0.2px;
}

.section-icon {
  color: var(--brand-color);
}

.section-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-color);
  background: var(--brand-subtle);
  padding: 3px 10px;
  border-radius: 100px;
  margin-left: 8px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--brand-color);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  font-family: inherit;
  box-shadow: 0 1px 3px rgba(59,130,246,0.3), 0 4px 12px rgba(59,130,246,0.2);
  letter-spacing: 0.1px;
}

.btn-primary:hover {
  background: var(--brand-hover);
  box-shadow: 0 2px 6px rgba(59,130,246,0.35), 0 6px 18px rgba(59,130,246,0.28);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(59,130,246,0.3);
}
</style>
