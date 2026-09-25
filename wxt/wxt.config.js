import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    // 单机版专用命名（与团队版 ALOCS-1688 区分）
    name: 'ALOCS-1688 单机版',
    description: 'ALOCS-1688 单机版 — 数据保存在本机浏览器，装上即用',
    host_permissions: [],
    permissions: ['storage'],
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