import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    // 单机版专用命名（与团队版 ALOCS-1688 区分）
    name: 'ALOCS-1688 单机版',
    description: 'ALOCS-1688 单机版 — 数据保存在本机浏览器，装上即用；配置服务器地址即可多人共享',
    // 允许访问用户填写的局域网/公网服务器（http/https）
    host_permissions: ['http://*/*', 'https://*/*'],
    permissions: ['storage', 'alarms'],
  },
  vite: () => ({
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
  }),
  resolve: {
    alias: {
      '@': '/',
      '@entrypoints': '/entrypoints',
      '@stores': '/stores',
    },
  },
});