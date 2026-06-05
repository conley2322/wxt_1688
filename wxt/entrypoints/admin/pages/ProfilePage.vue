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

function selectColor(color) {
  user.avatar_color = color
  customColor.value = color
}

function applyCustomColor() {
  const c = customColor.value.trim()
  if (c && /^#[0-9a-fA-F]{6}$/.test(c)) {
    user.avatar_color = c
  } else if (c) {
    ElMessage.warning('请输入有效的十六进制颜色，如 #ff6a00')
  }
}

async function saveProfile() {
  saving.value = true
  try {
    const body = { avatar_color: user.avatar_color || null }
    if (user.email) body.email = user.email
    const res = await api('/api/v1/users/profile', 'PUT', body)
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
  <section v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">个人中心</h2>
    </div>

    <el-row :gutter="24">
      <!-- 左侧：头像预览 + 颜色选择 -->
      <el-col :span="10">
        <el-card>
          <template #header><span>头像设置</span></template>
          <div class="avatar-section">
            <div class="avatar-preview" :style="{ background: displayColor }">
              {{ avatarInitial }}
            </div>
            <p class="avatar-hint">选择你喜欢的头像颜色</p>
          </div>
          <div class="color-grid">
            <span
              v-for="c in presetColors" :key="c"
              class="color-swatch"
              :class="{ active: user.avatar_color === c }"
              :style="{ background: c }"
              @click="selectColor(c)"
            ></span>
          </div>
          <div class="custom-color-row">
            <el-input v-model="customColor" placeholder="#ff6a00" size="small" style="width: 130px" @blur="applyCustomColor" />
            <el-button size="small" @click="applyCustomColor">自定义</el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：账户信息 + 密码 -->
      <el-col :span="14">
        <el-card>
          <template #header><span>账户信息</span></template>
          <el-form label-width="80px" size="default">
            <el-form-item label="用户名">
              <el-input :model-value="user.username" disabled />
            </el-form-item>
            <el-form-item label="角色">
              <el-tag :type="user.role === 'admin' ? 'warning' : 'info'" size="small">
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </el-tag>
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="user.email" placeholder="请输入邮箱" />
            </el-form-item>
            <el-form-item label="注册时间" v-if="user.created_at">
              <span class="info-text">{{ user.created_at }}</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveProfile">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card style="margin-top: 16px">
          <template #header><span>修改密码</span></template>
          <el-form label-width="80px" size="default">
            <el-form-item label="当前密码">
              <el-input v-model="pwForm.current" type="password" show-password placeholder="输入当前密码" />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="pwForm.newPw" type="password" show-password placeholder="输入新密码" />
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
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0; }
.page-header { margin-bottom: 24px; }

.avatar-section {
  display: flex; flex-direction: column; align-items: center;
  margin-bottom: 20px;
}
.avatar-preview {
  width: 80px; height: 80px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 32px; font-weight: 700;
  margin-bottom: 8px;
}
.avatar-hint { font-size: 13px; color: #999; margin: 0; }

.color-grid {
  display: flex; flex-wrap: wrap; gap: 10px;
  justify-content: center; margin-bottom: 12px;
}
.color-swatch {
  width: 32px; height: 32px; border-radius: 50%;
  cursor: pointer; border: 3px solid transparent;
  transition: border-color 0.2s, transform 0.2s;
}
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.active { border-color: #333; transform: scale(1.1); }

.custom-color-row {
  display: flex; gap: 8px; justify-content: center;
}
.info-text { color: #999; font-size: 13px; }
</style>
