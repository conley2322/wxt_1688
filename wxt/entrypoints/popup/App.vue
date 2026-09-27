<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth.js'

// 单机版：弹窗只做身份展示，所有编辑都进管理后台
const auth = useAuthStore()

onMounted(() => auth.restoreSession())

function openAdmin() {
  window.open(chrome.runtime.getURL('admin.html'))
}
</script>

<template>
  <div class="popup-root">
    <div class="popup-brand">
      <img src="/logo.svg" alt="Logo" width="16" height="16" />
      <span>ALOCS-1688</span>
      <em>单机版</em>
    </div>

    <div class="profile-row">
      <div class="avatar" :style="{ background: auth.avatarColor }">{{ auth.nickname.charAt(0) }}</div>
      <div class="profile-meta">
        <div class="profile-name">{{ auth.nickname }}</div>
        <div class="profile-sub">本地资料 · 数据存于本机</div>
      </div>
    </div>

    <button class="btn-admin" @click="openAdmin">
      打开管理后台
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  </div>
</template>

<style scoped>
.popup-root {
  width: 260px;
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif;
  background: #ffffff;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.popup-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #333;
}
.popup-brand em {
  font-style: normal;
  font-size: 10px;
  color: #c9975c;
  background: rgba(201, 151, 92, 0.1);
  border-radius: 3px;
  padding: 1px 5px;
  font-weight: 600;
}
.profile-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #faf8f5;
  border: 1px solid #f0ece6;
  border-radius: 10px;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-meta {
  min-width: 0;
}
.profile-name {
  font-size: 14px;
  font-weight: 600;
  color: #222;
  line-height: 1.3;
}
.profile-sub {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
  line-height: 1.3;
}
.btn-admin {
  width: 100%;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #c9975c;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: background 0.15s ease;
}
.btn-admin:hover {
  background: #b8884c;
}
.btn-admin:active {
  background: #a87a42;
}
</style>
