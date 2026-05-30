import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  //代理转发
  manifest: {
    host_permissions: ['http://localhost:3001/*'],
    permissions: ['storage'],
  },
  //使用@来表示wxt项目根目录
  resolve: {
    alias: {
      '@': '/',
      '@entrypoints': '/entrypoints',
      '@stores': '/stores',
    },
  },
});
