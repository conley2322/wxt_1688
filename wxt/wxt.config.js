import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    // 单机版专用命名（与团队版 ALOCS-1688 区分）
    name: 'ALOCS-1688 单机版',
    description: 'ALOCS-1688 单机版 — 数据保存在本机浏览器，装上即用；配置服务器地址即可多人共享',
    // 公钥：把扩展 ID 钉死为 jfmjpidelkddbbfdjaopimehhconoekm，
    // 与路径/打包方式/版本号无关。私钥在 .keys/（已 gitignore），换机器务必一并备份。
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApBxUpyxr99NOVjJkGgcL5bvj/l6vQLtd+mF2kt943q/E/JLbtKOuQYOnNOTaUGsdHWV796pgwpzoAyPhfpDqQ+gdk0R0UjEcG3Ei8sFI9SU5DG9NfJmg+r0WEH4oSH/xZwnpH8k0sVF4PKdxrWLW5n7kfj6glpmJW7fOEIUbEQfhKqns1/Vw4eQXvjIUbK4Qd/fYxSs9ThWy1qDM4nJBSfBjfPVAYpTsWexCxh7k30oySDxiljSSO0k3AD5sx1FKNjrv7/6rCWlDmjjBqpTYOBM7jUPeRkTtiCuZD4kr4OIILbhW0UBlGThFGxCHUeXIj4E+qbxLC19tx1pDZ3BZ+wIDAQAB',
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