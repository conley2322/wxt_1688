<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth.js'

// 单机版：无登录。首次使用设置昵称（默认"我"+通用灰头像），随时可改。
const auth = useAuthStore()

const editName = ref('')
const editColor = ref('#8a8f99')
const saving = ref(false)
const saved = ref(false)

const presetColors = ['#8a8f99', '#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12']

onMounted(() => auth.restoreSession())

function startEdit() {
  editName.value = auth.nickname
  editColor.value = auth.avatarColor
}

async function saveProfile() {
  if (!editName.value.trim()) return
  saving.value = true
  await auth.save({ nickname: editName.value.trim(), avatar_color: editColor.value })
  saving.value = false
  saved.value = true
  setTimeout(() => { saved.value = false }, 1500)
}

function openAdmin() {
  window.open(chrome.runtime.getURL('admin.html'))
}
</script>

<template>
  <div class="popup-root">
    <div class="popup-brand">
      <img src="/logo.svg" alt="Logo" width="22" height="22" />
      <span>ALOCS-1688 <em>单机版</em></span>
    </div>

    <div class="popup-card">
      <div class="avatar" :style="{ background: auth.avatarColor }">{{ auth.nickname.charAt(0) }}</div>
      <div class="profile-name">{{ auth.nickname }}</div>
      <div class="profile-hint">数据保存在本机浏览器，装好即用</div>

      <!-- 编辑资料 -->
      <div class="edit-area">
        <input v-model="editName" class="name-input" maxlength="12" placeholder="输入昵称" @focus="startEdit" />
        <div class="color-row">
          <span
            v-for="c in presetColors"
            :key="c"
            class="color-dot"
            :class="{ active: editColor === c }"
            :style="{ background: c }"
            @click="editColor = c"
          ></span>
        </div>
        <button class="btn-save" :disabled="saving || !editName.trim()" @click="saveProfile">
          {{ saved ? '已保存 ✓' : '保存资料' }}
        </button>
      </div>
    </div>

    <button class="btn-admin" @click="openAdmin">打开管理后台</button>

    <div class="popup-foot">浏览 1688 时自动记录，数据仅保存在本机</div>
  </div>
</template>

<style scoped>
.popup-root {
  width: 320px;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", Arial, sans-serif;
  background: #faf9f7;
  min-height: 320px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.popup-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #333;
  margin-bottom: 14px;
}
.popup-brand em {
  font-style: normal;
  font-size: 10px;
  color: #fff;
  background: #c9975c;
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 600;
}
.popup-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  margin: 0 auto 8px;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}
.profile-hint {
  font-size: 11px;
  color: #b0b3b8;
  margin: 4px 0 14px;
}
.edit-area {
  border-top: 1px dashed #eee;
  padding-top: 14px;
}
.name-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  text-align: center;
  outline: none;
}
.name-input:focus {
  border-color: #c9975c;
}
.color-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 12px 0;
}
.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  box-sizing: border-box;
}
.color-dot.active {
  border-color: #333;
}
.btn-save {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: #c9975c;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-save:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn-admin {
  margin-top: 12px;
  width: 100%;
  padding: 9px;
  border: 1px solid #c9975c;
  border-radius: 8px;
  background: #fff;
  color: #c9975c;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-admin:hover {
  background: #fdf6ee;
}
.popup-foot {
  margin-top: auto;
  padding-top: 12px;
  text-align: center;
  font-size: 10px;
  color: #c0c4cc;
}
</style>
