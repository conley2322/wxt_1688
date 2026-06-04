<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app.js'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const showContent = ref(false)
const isAdmin = ref(false)

const allNavItems = [
  { path: '/dashboard', label: '概览', icon: 'DataBoard' },
  { path: '/users', label: '用户管理', icon: 'User', adminOnly: true },
  { path: '/products', label: '商品管理', icon: 'Goods' },
  { path: '/tags', label: '标签管理', icon: 'CollectionTag' },
  { path: '/updates', label: '更新日志', icon: 'Clock' },
  { path: '/settings', label: '系统设置', icon: 'Setting' },
]

const navItems = computed(() => allNavItems.filter(item => !item.adminOnly || isAdmin.value))

onMounted(async () => {
  console.log('[Admin] 挂载, 路由:', route.path)
  // 初始化应用 Store（版本号、设置等）
  await appStore.init()
  if (appStore.config.settings.autoCheckUpdate) {
    appStore.checkUpdate()
  }
  if (appStore.config.update.hasUpdate) {
    console.log(`[App] 发现新版本: ${appStore.config.update.latestVersion}`)
  }
  // 检查当前用户角色
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
        console.log('[Admin] 角色:', me?.role, 'isAdmin:', isAdmin.value)
      }
    }
  } catch (e) { console.error('[Admin] 角色检查失败:', e) }
  showContent.value = true
})
</script>

<template>
  <div class="admin-root" :class="{ 'content-visible': showContent }">
    <el-menu :default-active="route.path" class="sidebar" @select="(path) => router.push(path)">
      <div class="sidebar-brand">
        <span class="brand-icon">
          <img src="/logo.svg" alt="Logo" width="24" height="24" />
        </span>
        <span class="brand-text">{{ appStore.config.app.name }}</span>
      </div>
      <el-menu-item v-for="item in navItems" :key="item.path" :index="item.path">
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </el-menu-item>
    </el-menu>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-root { display: flex; min-height: 100vh; background: #f5f7fa; opacity: 0; transition: opacity 0.4s; }
.admin-root.content-visible { opacity: 1; }
.sidebar { width: 200px; min-height: 100vh; position: fixed; top: 0; left: 0; }
.sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 20px 16px 16px; border-bottom: 1px solid #e4e7ed; margin-bottom: 8px; }
.brand-icon { display: flex; }
.brand-text { font-size: 16px; font-weight: 700; color: #000000; }
.main-content { flex: 1; margin-left: 200px; padding: 24px 32px; }
</style>
