import { createRouter, createWebHashHistory } from 'vue-router'

// 单机版：无账号体系，无需权限守卫
const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: () => import('./pages/Dashboard.vue'), meta: { title: '概览' } },
  { path: '/sources', component: () => import('./pages/MySources.vue'), meta: { title: '我的货源' } },
  // 旧路径兼容（商品/供应商管理已合并为「我的货源」）
  { path: '/products', redirect: '/sources' },
  { path: '/suppliers', redirect: '/sources' },
  { path: '/updates', component: () => import('./pages/UpdateManage.vue'), meta: { title: '更新日志' } },
  { path: '/updates/publish', component: () => import('./pages/UpdateEditor.vue'), meta: { title: '发布更新' } },
  { path: '/operations', component: () => import('./pages/OperationLogs.vue'), meta: { title: '操作记录' } },
  { path: '/settings', component: () => import('./pages/SettingsPage.vue'), meta: { title: '系统设置' } },
  { path: '/profile', component: () => import('./pages/ProfilePage.vue'), meta: { title: '个人中心' } },
  { path: '/about', component: () => import('./pages/AboutPage.vue'), meta: { title: '关于我们' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
