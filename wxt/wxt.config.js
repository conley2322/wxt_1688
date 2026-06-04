import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    host_permissions: ['http://*:3000/*'],
    permissions: ['storage'],
  },
  resolve: {
    alias: {
      '@': '/',
      '@entrypoints': '/entrypoints',
      '@stores': '/stores',
    },
  },
});