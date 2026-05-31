<script setup>
import { ref, onMounted } from 'vue'
import { useApiStore } from '@/stores/api/api.js'

const store = useApiStore()
const showContent = ref(false)
const boxDefault = ref('product') // 'product' or 'supplier'

onMounted(async () => {
  showContent.value = true
  // 读取用户配置
  try {
    const stored = await browser.storage.local.get('boxDefault')
    if (stored.boxDefault) boxDefault.value = stored.boxDefault
  } catch {}
})

async function saveSetting() {
  await browser.storage.local.set({ boxDefault: boxDefault.value })
}
</script>

<template>
  <div class="admin-root" :class="{ 'content-visible': showContent }">
    <div class="bg-glow glow-top"></div>
    <div class="bg-glow glow-bottom"></div>

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
        <button class="nav-item active">
          <span class="nav-label">偏好设置</span>
        </button>
      </nav>
    </aside>

    <main class="main-content">
      <section class="page">
        <div class="page-header">
          <h1 class="page-title">偏好设置</h1>
          <p class="page-desc">自定义插件显示行为</p>
        </div>

        <div class="setting-card">
          <div class="setting-row">
            <div class="setting-info">
              <h3>搜索列表默认面板</h3>
              <p>在 1688 搜索结果中，默认显示商品信息还是供应商信息</p>
            </div>
            <select v-model="boxDefault" @change="saveSetting" class="setting-select">
              <option value="product">商品信息</option>
              <option value="supplier">供应商信息</option>
            </select>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-root {
  --sidebar-w: 220px;
  --accent: #c9975c;
  --accent-soft: rgba(201, 151, 92, 0.12);
  --accent-hover: rgba(201, 151, 92, 0.08);
  --card-border: #ede8e0;
  --text-primary: #1c1c1e;
  --text-secondary: #8b8580;
  --bg-card: #ffffff;
  --bg-body: #faf8f5;

  display: flex;
  min-height: 100vh;
  background: var(--bg-body);
  opacity: 0;
  transition: opacity 0.6s ease;
}
.admin-root.content-visible { opacity: 1; }

.bg-glow {
  position: fixed;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  z-index: 0;
}
.glow-top {
  width: 500px; height: 500px; top: -200px; right: -150px;
  background: radial-gradient(circle, rgba(201, 151, 92, 0.08), transparent);
}
.glow-bottom {
  width: 400px; height: 400px; bottom: -180px; left: 260px;
  background: radial-gradient(circle, rgba(201, 151, 92, 0.06), transparent);
}

.sidebar {
  position: fixed; top: 0; left: 0; width: var(--sidebar-w); height: 100vh;
  background: var(--bg-card);
  border-right: 1px solid var(--card-border);
  display: flex; flex-direction: column; z-index: 10;
}
.sidebar-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 24px 20px 20px;
  border-bottom: 1px solid var(--card-border);
}
.brand-icon {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--accent-soft); color: var(--accent);
}
.brand-text { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.sidebar-nav { flex: 1; padding: 12px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 10px 12px; border: none; border-radius: 8px;
  background: transparent; color: var(--text-secondary);
  font-size: 14px; font-family: inherit; cursor: pointer;
}
.nav-item.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.nav-label { line-height: 1; }

.main-content {
  flex: 1; margin-left: var(--sidebar-w);
  padding: 40px 48px; position: relative; z-index: 1;
}
.page { max-width: 600px; }
.page-header { margin-bottom: 32px; }
.page-title { font-size: 24px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
.page-desc { font-size: 14px; color: var(--text-secondary); margin: 0; }

.setting-card {
  background: var(--bg-card);
  border: 1px solid var(--card-border);
  border-radius: 14px; padding: 24px;
}
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.setting-info h3 { font-size: 15px; color: var(--text-primary); margin: 0 0 4px; }
.setting-info p { font-size: 13px; color: var(--text-secondary); margin: 0; }
.setting-select {
  padding: 8px 12px; border: 1px solid var(--card-border);
  border-radius: 8px; font-size: 14px; font-family: inherit;
  background: var(--bg-body); color: var(--text-primary); cursor: pointer;
  flex-shrink: 0;
}
</style>
