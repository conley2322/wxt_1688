import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: () => import('./pages/Dashboard.vue'), meta: { title: '概览' } },
  { path: '/users', component: () => import('./pages/UserManage.vue'), meta: { title: '用户管理', needAdmin: true } },
  { path: '/products', component: () => import('./pages/ProductManage.vue'), meta: { title: '商品管理' } },
  { path: '/tags', component: () => import('./pages/TagManage.vue'), meta: { title: '标签管理' } },
  { path: '/updates', component: () => import('./pages/UpdateManage.vue'), meta: { title: '更新日志' } },
  { path: '/updates/publish', component: () => import('./pages/UpdateEditor.vue'), meta: { title: '发布更新', needAdmin: true } },
  { path: '/suppliers', component: () => import('./pages/SupplierManage.vue'), meta: { title: '供应商管理' } },
  { path: '/settings', component: () => import('./pages/SettingsPage.vue'), meta: { title: '系统设置' } },
  { path: '/about', component: () => import('./pages/AboutPage.vue'), meta: { title: '关于我们' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 权限守卫：非管理员不能访问 needAdmin 页面
router.beforeEach(async (to) => {
  if (to.meta.needAdmin) {
    const stored = await browser.storage.local.get(['token', 'serverAddress', 'username'])
    if (stored.token && stored.serverAddress) {
      try {
        const res = await fetch(`${stored.serverAddress}/api/v1/users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: stored.username, password: '' })
        })
        // 不验证密码，只用已有 token 获取角色
        const usersRes = await fetch(`${stored.serverAddress}/api/v1/users`, {
          headers: { 'Authorization': `Bearer ${stored.token}` }
        })
        const usersData = await usersRes.json()
        if (usersData.code === 200) {
          const me = usersData.data?.find(u => u.username === stored.username)
          if (me && me.role !== 'admin') {
            return { path: '/dashboard' }
          }
        }
      } catch {}
    }
  }
})

export default router
