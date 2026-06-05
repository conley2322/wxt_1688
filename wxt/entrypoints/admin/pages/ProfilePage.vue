<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../utils/useApi.js'

const loading = ref(true)
const saving = ref(false)
const user = reactive({
  id: null,
  username: '',
  email: '',
  avatar_color: null,
  role: '',
  created_at: ''
})

// 预设颜色
const presetColors = ['#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']
const customColor = ref('')

// 密码修改
const pwForm = reactive({ current: '', newPw: '', confirm: '' })

// 头像首字母
const avatarInitial = computed(() => (user.username || '?').charAt(0).toUpperCase())

// 当前显示颜色：用户自选 > 哈希降级
const displayColor = computed(() => {
  if (user.avatar_color) return user.avatar_color
  // 哈希降级
  let hash = 0
  const name = user.username || ''
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return presetColors[Math.abs(hash) % presetColors.length]
})

onMounted(async () => {
  await loadProfile()
})

async function loadProfile() {
  try {
    const stored = await browser.storage.local.get(['username', 'token', 'serverAddress'])
    const res = await api('/api/v1/users?page_size=100', 'GET')
    if (res.code === 200) {
      const me = res.data.find(u => u.username === stored.username)
      if (me) {
        Object.assign(user, me)
        if (me.avatar_color) customColor.value = me.avatar_color
      }
    }
  } catch (e) {
    ElMessage.error('加载用户信息失败')
  } finally {
    loading.value = false
  }
}

async function saveColor(color) {
  try {
    const res = await api('/api/v1/users/profile', 'PUT', { avatar_color: color })
    if (res.code === 200) {
      ElMessage.success('头像颜色已更新')
    }
  } catch {
    ElMessage.error('保存失败')
  }
}

function selectColor(color) {
  user.avatar_color = color
  customColor.value = color
  saveColor(color)
}

function applyCustomColor() {
  const c = customColor.value.trim()
  if (c && /^#[0-9a-fA-F]{6}$/.test(c)) {
    user.avatar_color = c
    saveColor(c)
  } else if (c) {
    ElMessage.warning('请输入有效的十六进制颜色，如 #ff6a00')
  }
}

function onNativeColorPick(e) {
  const c = e.target.value
  if (c) {
    user.avatar_color = c
    customColor.value = c
    saveColor(c)
  }
}

async function saveProfile() {
  saving.value = true
  try {
    const res = await api('/api/v1/users/profile', 'PUT', { email: user.email || '' })
    if (res.code === 200) {
      ElMessage.success('保存成功')
      Object.assign(user, res.data)
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  if (!pwForm.current) { ElMessage.warning('请输入当前密码'); return }
  if (!pwForm.newPw) { ElMessage.warning('请输入新密码'); return }
  if (pwForm.newPw !== pwForm.confirm) { ElMessage.warning('两次密码输入不一致'); return }
  if (pwForm.newPw.length < 4) { ElMessage.warning('密码至少4位'); return }
  try {
    const res = await api('/api/v1/users/profile', 'PUT', {
      current_password: pwForm.current,
      new_password: pwForm.newPw
    })
    if (res.code === 200) {
      ElMessage.success('密码修改成功')
      pwForm.current = ''
      pwForm.newPw = ''
      pwForm.confirm = ''
    } else {
      ElMessage.error(res.message || '修改失败')
    }
  } catch (e) {
    ElMessage.error('修改失败')
  }
}
</script>

<template>
  <section class="profile-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">个人中心</h2>
    </div>

    <!-- 顶部：头像 + 基本信息概览 -->
    <div class="profile-hero">
      <div class="hero-avatar-wrap">
        <div class="hero-avatar" :style="{ background: displayColor }">
          {{ avatarInitial }}
        </div>
        <div class="hero-info">
          <div class="hero-name">{{ user.username }}</div>
          <div class="hero-meta">
            <el-tag :type="user.role === 'admin' ? 'warning' : 'info'" size="small">
              {{ user.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
            <span v-if="user.created_at" class="hero-date">注册于 {{ user.created_at?.slice(0, 10) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主体：双栏 -->
    <el-row :gutter="24" class="profile-body">
      <!-- 左：头像颜色 -->
      <el-col :md="12" :sm="24">
        <el-card shadow="hover" class="profile-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">头像颜色</span>
              <span class="card-sub">选择你的专属色彩</span>
            </div>
          </template>
          <div class="color-section">
            <div class="color-presets">
              <button
                v-for="c in presetColors" :key="c"
                class="color-btn"
                :class="{ active: user.avatar_color === c }"
                :style="{ '--c': c }"
                @click="selectColor(c)"
                :aria-label="`选择颜色 ${c}`"
              >
                <svg v-if="user.avatar_color === c" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
            <div class="color-custom">
              <span class="color-custom-label">自选</span>
              <input
                type="color"
                :value="user.avatar_color || '#ff6a00'"
                class="native-picker"
                @change="onNativeColorPick"
              />
              <el-input
                v-model="customColor"
                placeholder="#ff6a00"
                size="small"
                class="color-input"
                @blur="applyCustomColor"
                @keyup.enter="applyCustomColor"
              />
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右：账户 + 密码 -->
      <el-col :md="12" :sm="24">
        <el-card shadow="hover" class="profile-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">账户信息</span>
            </div>
          </template>
          <el-form label-width="72px" size="default" class="profile-form">
            <el-form-item label="邮箱">
              <el-input v-model="user.email" placeholder="请输入邮箱地址" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveProfile" class="save-btn">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="hover" class="profile-card" style="margin-top: 16px">
          <template #header>
            <div class="card-header">
              <span class="card-title">修改密码</span>
            </div>
          </template>
          <el-form label-width="72px" size="default" class="profile-form">
            <el-form-item label="当前密码">
              <el-input v-model="pwForm.current" type="password" show-password placeholder="输入当前密码" />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="pwForm.newPw" type="password" show-password placeholder="至少 4 位" />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="pwForm.confirm" type="password" show-password placeholder="再次输入新密码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="changePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </section>
</template>

<style scoped>
/* ── 页面 ── */
.profile-page { max-width: 900px; }

.page-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0; letter-spacing: -0.3px; }
.page-header { margin-bottom: 28px; }

/* ── 顶部 Hero ── */
.profile-hero {
  background: linear-gradient(135deg, #f8f9fc 0%, #f0f2f8 100%);
  border-radius: 16px;
  padding: 28px 32px;
  margin-bottom: 24px;
  border: 1px solid #eef0f6;
}
.hero-avatar-wrap {
  display: flex; align-items: center; gap: 20px;
}
.hero-avatar {
  width: 72px; height: 72px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 28px; font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
}
.hero-info { min-width: 0; }
.hero-name { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 6px; }
.hero-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.hero-date { font-size: 13px; color: #999; }

/* ── 卡片 ── */
.profile-card {
  border-radius: 12px;
  border: 1px solid #eef0f6;
}
.profile-card :deep(.el-card__header) {
  padding: 18px 24px 12px;
  border-bottom: 1px solid #f2f3f8;
}
.profile-card :deep(.el-card__body) {
  padding: 20px 24px 24px;
}
.card-header {
  display: flex; align-items: baseline; gap: 8px;
}
.card-title { font-size: 15px; font-weight: 600; color: #1a1a2e; }
.card-sub { font-size: 12px; color: #b0b5c0; }

/* ── 颜色选择器 ── */
.color-section { display: flex; flex-direction: column; gap: 20px; }

.color-presets {
  display: flex; flex-wrap: wrap; gap: 12px;
}
.color-btn {
  width: 40px; height: 40px; border-radius: 12px;
  border: none; cursor: pointer;
  background: var(--c);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}
.color-btn:hover {
  transform: scale(1.12);
  box-shadow: 0 2px 12px rgba(0,0,0,0.18);
}
.color-btn.active {
  transform: scale(1.1);
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--c);
}
.color-btn svg { filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2)); }

.color-custom {
  display: flex; align-items: center; gap: 10px;
}
.color-custom-label { font-size: 13px; color: #888; flex-shrink: 0; }
.color-input { width: 130px; }

.native-picker {
  width: 32px; height: 32px;
  border: 1px solid #ddd; border-radius: 8px;
  padding: 2px; cursor: pointer;
  background: transparent;
}
.native-picker::-webkit-color-swatch-wrapper { padding: 0; }
.native-picker::-webkit-color-swatch { border-radius: 6px; border: none; }

/* ── 表单 ── */
.profile-form :deep(.el-form-item) { margin-bottom: 18px; }
.profile-form :deep(.el-form-item__label) { font-weight: 500; color: #555; }
.save-btn { min-width: 100px; }

@media (max-width: 768px) {
  .profile-hero { padding: 20px; }
  .hero-avatar { width: 56px; height: 56px; font-size: 22px; }
  .hero-name { font-size: 17px; }
  .profile-card :deep(.el-card__body) { padding: 16px; }
  .color-btn { width: 36px; height: 36px; }
}
</style>
