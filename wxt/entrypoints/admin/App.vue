<script setup>
import { ref, onMounted } from 'vue'
import { useApiStore } from '@/stores/api/api.js'

const apiStore = useApiStore()

const showContent = ref(false)
const currentPage = ref('dashboard')

const navItems = [
  {
    id: 'dashboard',
    label: '概览',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
  },
  {
    id: 'products',
    label: '商品管理',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  },
  {
    id: 'tags',
    label: '标签管理',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  },
  {
    id: 'comments',
    label: '评论管理',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  },
  {
    id: 'settings',
    label: '系统设置',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  },
]

onMounted(() => {
  console.log('现在是admin页面')
  apiStore.ajax('/api/v1/products/Product_browsing_history', 'GET').then(res => {
    console.log(res)
  })
})
</script>

<template>
  <div class="admin-root" :class="{ 'content-visible': showContent }">
    <!-- 背景光晕 -->
    <div class="bg-glow glow-top"></div>
    <div class="bg-glow glow-bottom"></div>

    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="2" width="28" height="28" rx="8" stroke="currentColor" stroke-width="1.5" />
            <path d="M10 16h12M16 10v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.3" />
          </svg>
        </div>
        <span class="brand-text">1688 助手</span>
      </div>

      <nav class="sidebar-nav">
        <button v-for="item in navItems" :key="item.id" class="nav-item" :class="{ active: currentPage === item.id }"
          @click="currentPage = item.id">
          <span class="nav-icon" v-html="item.icon"></span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <button class="footer-btn" @click="goBack">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          关闭页面
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <Transition name="page-enter" mode="out-in">
        <!-- 概览 -->
        <section v-if="currentPage === 'dashboard'" key="dashboard" class="page">
          <div class="page-header">
            <h1 class="page-title">概览</h1>
            <p class="page-desc">系统运行状态一览</p>
          </div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon stat-icon--blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div class="stat-body">
                <span class="stat-value">—</span>
                <span class="stat-label">已管理商品</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon--gold">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </div>
              <div class="stat-body">
                <span class="stat-value">—</span>
                <span class="stat-label">标签总数</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon--green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div class="stat-body">
                <span class="stat-value">—</span>
                <span class="stat-label">评论记录</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon--rose">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div class="stat-body">
                <span class="stat-value">—</span>
                <span class="stat-label">浏览统计</span>
              </div>
            </div>
          </div>
          <div class="welcome-card">
            <h2>欢迎使用 1688 采购助手</h2>
            <p>在这里管理商品标签、审核评论、查看浏览数据。左侧导航切换功能，数据将随使用逐步填充。</p>
          </div>
        </section>

        <!-- 商品管理 -->
        <section v-else-if="currentPage === 'products'" key="products" class="page">
          <div class="page-header">
            <h1 class="page-title">商品管理</h1>
            <p class="page-desc">管理 1688 商品信息与标签</p>
          </div>
          <div class="placeholder-card">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
              stroke-linecap="round">
              <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <p>商品列表与标签分配功能即将上线</p>
          </div>
        </section>

        <!-- 标签管理 -->
        <section v-else-if="currentPage === 'tags'" key="tags" class="page">
          <div class="page-header">
            <h1 class="page-title">标签管理</h1>
            <p class="page-desc">创建和管理标签池</p>
          </div>
          <div class="placeholder-card">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
              stroke-linecap="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            </svg>
            <p>标签池管理与分类功能即将上线</p>
          </div>
        </section>

        <!-- 评论管理 -->
        <section v-else-if="currentPage === 'comments'" key="comments" class="page">
          <div class="page-header">
            <h1 class="page-title">评论管理</h1>
            <p class="page-desc">审核与管理用户评论</p>
          </div>
          <div class="placeholder-card">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
              stroke-linecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>评论审核与回复功能即将上线</p>
          </div>
        </section>

        <!-- 系统设置 -->
        <section v-else-if="currentPage === 'settings'" key="settings" class="page">
          <div class="page-header">
            <h1 class="page-title">系统设置</h1>
            <p class="page-desc">配置服务器与系统参数</p>
          </div>
          <div class="placeholder-card">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
              stroke-linecap="round">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <p>系统配置功能即将上线</p>
          </div>
        </section>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════
   布局
   ═══════════════════════════════════════════ */
.admin-root {
  --sidebar-w: 220px;
  --accent: #c9975c;
  --accent-soft: rgba(201, 151, 92, 0.12);
  --accent-hover: rgba(201, 151, 92, 0.08);
  --card-border: #ede8e0;
  --text-primary: #1c1c1e;
  --text-secondary: #8b8580;
  --text-tertiary: #b8b2ab;
  --bg-card: #ffffff;
  --bg-body: #faf8f5;
  --sidebar-bg: #ffffff;

  display: flex;
  min-height: 100vh;
  background: var(--bg-body);
  opacity: 0;
  transition: opacity 0.6s ease;
}

.admin-root.content-visible {
  opacity: 1;
}

/* ───── 背景光晕 ───── */
.bg-glow {
  position: fixed;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  z-index: 0;
}

.glow-top {
  width: 500px;
  height: 500px;
  top: -200px;
  right: -150px;
  background: radial-gradient(circle, rgba(201, 151, 92, 0.08), transparent);
  animation: glowDrift 18s ease-in-out infinite alternate;
}

.glow-bottom {
  width: 400px;
  height: 400px;
  bottom: -180px;
  left: 260px;
  background: radial-gradient(circle, rgba(201, 151, 92, 0.06), transparent);
  animation: glowDrift 22s ease-in-out infinite alternate-reverse;
}

@keyframes glowDrift {
  0% {
    transform: translate(0, 0) scale(1);
  }

  100% {
    transform: translate(40px, -30px) scale(1.08);
  }
}

/* ═══════════════════════════════════════════
   侧边栏
   ═══════════════════════════════════════════ */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-w);
  height: 100vh;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  z-index: 10;
  animation: sidebarEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes sidebarEnter {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ───── 品牌 ───── */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 20px 20px;
  border-bottom: 1px solid var(--card-border);
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.brand-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

/* ───── 导航 ───── */
.sidebar-nav {
  flex: 1;
  padding: 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--accent-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-label {
  line-height: 1;
}

/* ───── 底部 ───── */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--card-border);
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 9px;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  color: var(--text-secondary);
  border-color: #d5d0c8;
  background: #f7f5f2;
}

/* ═══════════════════════════════════════════
   主内容区
   ═══════════════════════════════════════════ */
.main-content {
  flex: 1;
  margin-left: var(--sidebar-w);
  padding: 40px 48px;
  position: relative;
  z-index: 1;
}

.page {
  max-width: 720px;
}

.page-header {
  margin-bottom: 32px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
  letter-spacing: 0.01em;
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* ───── 统计卡片 ───── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 20px;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;
}

.stat-icon--blue {
  background: rgba(99, 102, 241, 0.10);
  color: #6366f1;
}

.stat-icon--gold {
  background: var(--accent-soft);
  color: var(--accent);
}

.stat-icon--green {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}

.stat-icon--rose {
  background: rgba(244, 114, 182, 0.10);
  color: #f472b6;
}

.stat-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ───── 欢迎卡片 ───── */
.welcome-card {
  background: linear-gradient(135deg, rgba(201, 151, 92, 0.06), rgba(201, 151, 92, 0.02));
  border: 1px solid rgba(201, 151, 92, 0.15);
  border-radius: 14px;
  padding: 24px 28px;
}

.welcome-card h2 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.welcome-card p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

/* ───── 占位卡片 ───── */
.placeholder-card {
  background: var(--bg-card);
  border: 1px dashed var(--card-border);
  border-radius: 14px;
  padding: 60px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
}

.placeholder-card svg {
  color: var(--text-tertiary);
  opacity: 0.6;
}

.placeholder-card p {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0;
}

/* ═══════════════════════════════════════════
   页面切换动画
   ═══════════════════════════════════════════ */
.page-enter-enter-active {
  animation: pageIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.page-enter-leave-active {
  animation: pageOut 0.2s cubic-bezier(0.55, 0, 1, 0.45) both;
}

@keyframes pageIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pageOut {
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

/* ═══════════════════════════════════════════
   选中色
   ═══════════════════════════════════════════ */
::selection {
  background: rgba(201, 151, 92, 0.25);
  color: var(--text-primary);
}
</style>