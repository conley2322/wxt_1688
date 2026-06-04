<script setup>
import { ref, onMounted } from 'vue'
import { Calendar } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { api } from './useApi.js'
import UpdateTimeline from './UpdateTimeline.vue'

const router = useRouter()
const isAdmin = ref(false)

const version = '1.0.0'
const productName = 'ALOCS-1688 采购助手'
const producer = 'Conley'

const updates = ref([
  {
    version: '1.0.0',
    title: '正式发布',
    content: '<ul><li>新增商品管理瀑布流视图</li><li>支持评论图片点击放大查看</li><li>优化搜索筛选功能</li><li>修复若干已知问题</li></ul>',
    timestamp: '2026-06-04 10:00',
    status: 'published'
  },
  {
    version: '0.9.0',
    title: '测试版本',
    content: '<ul><li>完成基础商品信息采集</li><li>添加标签管理功能</li><li>实现评论系统</li></ul>',
    timestamp: '2026-05-20 14:30',
    status: 'published'
  },
  {
    version: '0.8.0',
    title: '基础功能',
    content: '<ul><li>项目初始化</li><li>浏览器扩展框架搭建</li><li>1688页面数据注入</li></ul>',
    timestamp: '2026-05-01 09:00',
    status: 'published'
  }
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
        <span>+</span>
        发布更新
      </button>
    </div>
    
    <UpdateTimeline :items="updates" />
  </section>
</template>

<style scoped>
:root {
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
  gap: 6px;
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--brand-color);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 150ms ease;
  font-family: inherit;
  box-shadow: 0 2px 8px rgba(59,130,246,0.25);
}

.btn-primary:hover {
  transform: translateY(-1px);
  background: var(--brand-hover);
  box-shadow: 0 4px 14px rgba(59,130,246,0.35);
}
</style>
