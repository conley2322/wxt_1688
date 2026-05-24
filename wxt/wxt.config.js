import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  //代理转发
  manifest: {
    host_permissions: ['http://localhost:3001/*'],
    permissions: ['storage'],
  },
});
