import { defineConfig } from 'wxt';
import { chromiumReleaseHooks } from './scripts/chromium-release.js';

export default defineConfig({
  hooks: chromiumReleaseHooks(),
  zip: { artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip' },
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    // 单机版专用命名（与团队版 ALOCS-1688 区分）
    name: 'ALOCS-1688 单机版',
    description: 'ALOCS-1688 单机版 — 数据保存在本机浏览器，装上即用；配置服务器地址即可多人共享',
    // 发布公钥。ZIP 和 CRX 的 ID 必须与 RELEASE_ID 一致。
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2X0k2YDURNL/HLgH8Hnq0HGCtqfA8ysySlPcsSXBq/JpNUUQFfBltOZjay3eWW+h8UJTaMz8DcZxs4zdpdu160YWW1ut154uPlWUtaHp3P3WpeFeuagSMc08CyJywnEpYjz4tuQg2aYNuRm1ep1UiR7mcIgctKkNKJo49dXajZVoJKeVj+dTcovOTyZNnT8UMfr0TJFYM9oWVTxDxqHCiVBhxdtbbeBsF3ck10V3v0nGghi0QoAPz3MlylJx427tZ7YTzrF9Wipmrpu6S1E4dZIOZn0ZwEtg7GF58l6envPBT8YGM6pfTiQ9IQ+giPsPY24DSkHw6get+tEw68SjQwIDAQAB',
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