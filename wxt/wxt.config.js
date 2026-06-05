import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    host_permissions: ['http://*:3000/*'],
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