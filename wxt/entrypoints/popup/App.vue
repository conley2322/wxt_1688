<script setup>
import { ref, onMounted, nextTick } from 'vue'

const isLoggedIn = ref(false)
const loading = ref(false)
const error = ref('')
const username = ref('')

const serverAddress = ref('')
const formUsername = ref('')
const formPassword = ref('')
const showContent = ref(false)
const isTransitioning = ref(false)

async function restoreSession() {// 从本地存储恢复会话
  try {
    const stored = await browser.storage.local.get(['token', 'username', 'serverAddress'])
    if (stored.token && stored.username) {
      username.value = stored.username
      serverAddress.value = stored.serverAddress || ''
      isLoggedIn.value = true
    }
  } catch (e) { /* ignore */ }
}

async function handleLogin() {// 处理登录
  if (!formUsername.value.trim()) return
  if (!serverAddress.value.trim()) return
  isTransitioning.value = true
  loading.value = true
  error.value = ''

  try {
    const baseUrl = serverAddress.value.trim().startsWith('http')
      ? serverAddress.value.trim()
      : `http://${serverAddress.value.trim()}`

    const response = await browser.runtime.sendMessage({
      type: 'api-request',
      url: `${baseUrl}/api/v1/users/login`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: formUsername.value, password: formPassword.value }),
    })

    if (!response || response.error) {
      throw new Error(response?.error || '连接失败，请检查服务器地址')
    }

    const data = response.data
    if (!response.ok || data.code !== 200) {
      throw new Error(data.message || '登录失败')
    }

    const { token, user } = data.data
    console.log(data.data);

    await browser.storage.local.set({
      token,
      username: user.username,
      serverAddress: baseUrl,
    })

    username.value = user.username
    serverAddress.value = baseUrl
    isLoggedIn.value = true

    await nextTick()
  } catch (e) {
    error.value = e.message || '登录失败，请重试'
    isLoggedIn.value = false
  } finally {
    loading.value = false
    setTimeout(() => { isTransitioning.value = false }, 600)
  }
}

function jumpToAdmin() {
  const url = chrome.runtime.getURL('/admin.html')
  chrome.tabs.create({ url })
}

async function handleLogout() {
  await browser.storage.local.remove(['token', 'username', 'serverAddress'])
  username.value = ''
  isLoggedIn.value = false
  error.value = ''
}

onMounted(async () => {
  await restoreSession()
  if (!isLoggedIn.value) {
    try {
      const stored = await browser.storage.local.get('serverAddress')

      if (stored.serverAddress) serverAddress.value = stored.serverAddress
    } catch (e) { /* ignore */ }
  }
  setTimeout(() => { showContent.value = true }, 30)
})
</script>

<template>
  <div class="popup-root" :class="{ 'content-visible': showContent }">
    <!-- 背景动态光晕 -->
    <div class="bg-layer">
      <div class="bg-glow glow-top"></div>
      <div class="bg-glow glow-bottom"></div>
      <div class="bg-grid"></div>
    </div>

    <!-- 登录页 -->
    <Transition name="card-swap" mode="out-in">
      <div v-if="!isLoggedIn" key="login" class="card login-card">
        <!-- 品牌头部 -->
        <div class="brand">
          <div class="brand-icon">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="8" stroke="currentColor" stroke-width="1.5" />
              <path d="M10 16h12M16 10v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
          <h1 class="brand-title">1688 助手</h1>
          <p class="brand-desc">登录以使用协作功能</p>
        </div>

        <!-- 表单 -->
        <div class="form">
          <div class="field" :style="{ '--i': 0 }">
            <label class="field-label" :class="{ 'has-value': serverAddress }">
              服务器地址
            </label>
            <input v-model="serverAddress" type="text" class="field-input" placeholder="192.168.x.x:3000"
              :disabled="loading" />
          </div>

          <div class="field" :style="{ '--i': 1 }">
            <label class="field-label" :class="{ 'has-value': formUsername }">
              账号
            </label>
            <input v-model="formUsername" type="text" class="field-input" placeholder="请输入用户名" :disabled="loading" />
          </div>

          <div class="field" :style="{ '--i': 2 }">
            <label class="field-label" :class="{ 'has-value': formPassword }">
              密码
            </label>
            <input v-model="formPassword" type="password" class="field-input" placeholder="请输入密码" :disabled="loading"
              @keyup.enter="handleLogin" />
          </div>
        </div>

        <!-- 错误提示 -->
        <Transition name="error-shake">
          <p v-if="error" class="error-msg">{{ error }}</p>
        </Transition>

        <!-- 登录按钮 -->
        <button class="login-btn" :class="{ loading }"
          :disabled="loading || !formUsername.trim() || !formPassword.trim()" @click="handleLogin">
          <span v-if="loading" class="btn-loading">
            <svg class="spinner" viewBox="0 0 24 24" width="18" height="18">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none"
                stroke-dasharray="31.4 31.4" stroke-linecap="round" />
            </svg>
            <span>登录中</span>
          </span>
          <span v-else class="btn-text">登 录</span>
        </button>
      </div>

      <!-- 已登录主页 -->
      <div v-else key="home" class="card home-card">
        <div class="avatar-ring">
          <div class="avatar">{{ username.charAt(0).toUpperCase() }}</div>
        </div>
        <h2 class="welcome-text">欢迎回来</h2>
        <div class="user-meta">
          <span class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {{ username }}
          </span>
          <span class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            {{ serverAddress?.replace(/^https?:\/\//, '') || '本地' }}
          </span>
        </div>

        <div class="home-actions">
          <button class="action-btn primary" @click="jumpToAdmin">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            管理后台
          </button>
          <button class="action-btn ghost" @click="handleLogout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            退出登录
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════
   基础 & 背景
   ═══════════════════════════════════ */
.popup-root {
  --bg: #faf8f5;
  --accent: #c9975c;
  --accent-soft: rgba(201, 151, 92, 0.12);
  --accent-glow: rgba(201, 151, 92, 0.18);
  --card-bg: #ffffff;
  --card-border: #ede8e0;
  --card-shadow: rgba(0, 0, 0, 0.06);
  --text-primary: #1c1c1e;
  --text-secondary: #8b8580;
  --text-tertiary: #b8b2ab;
  --input-bg: #f7f5f2;
  --input-border: #e5e0d8;
  --input-border-focus: var(--accent);
  --error: #e85050;

  position: relative;
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 24px;
  background: var(--bg);
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.6s ease;
}

.popup-root::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201, 151, 92, 0.07) 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(201, 151, 92, 0.05) 0%, transparent 60%);
  pointer-events: none;
}

.popup-root.content-visible {
  opacity: 1;
}

/* ───── 背景层 ───── */
.bg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.10;
}

.glow-top {
  width: 300px;
  height: 300px;
  top: -120px;
  right: -80px;
  background: radial-gradient(circle, #c9975c, transparent);
  animation: glowDrift 12s ease-in-out infinite alternate;
}

.glow-bottom {
  width: 250px;
  height: 250px;
  bottom: -100px;
  left: -60px;
  background: radial-gradient(circle, #d4a862, transparent);
  animation: glowDrift 15s ease-in-out infinite alternate-reverse;
}

@keyframes glowDrift {
  0% {
    transform: translate(0, 0) scale(1);
  }

  100% {
    transform: translate(30px, -20px) scale(1.1);
  }
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(201, 151, 92, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(201, 151, 92, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 50% 40%, black, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 40%, black, transparent 70%);
}

/* ═══════════════════════════════════
   卡片通用
   ═══════════════════════════════════ */
.card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 320px;
  padding: 32px 24px 28px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  box-shadow: 0 2px 12px var(--card-shadow), 0 8px 40px rgba(0, 0, 0, 0.04);
  animation: cardEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ═══════════════════════════════════
   品牌头部
   ═══════════════════════════════════ */
.brand {
  text-align: center;
  margin-bottom: 28px;
}

.brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent);
  margin-bottom: 12px;
  animation: iconPulse 3s ease-in-out infinite;
}

@keyframes iconPulse {

  0%,
  100% {
    box-shadow: 0 0 0 0 var(--accent-glow);
  }

  50% {
    box-shadow: 0 0 0 8px transparent;
  }
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
  letter-spacing: 0.02em;
}

.brand-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

/* ═══════════════════════════════════
   表单
   ═══════════════════════════════════ */
.form {
  margin-bottom: 20px;
}

.field {
  margin-bottom: 14px;
  animation: fieldEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(0.1s + var(--i, 0) * 0.1s);
}

@keyframes fieldEnter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
  letter-spacing: 0.01em;
  transition: color 0.25s ease;
}

.field:focus-within .field-label {
  color: var(--accent);
}

.field-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
}

.field-input::placeholder {
  color: var(--text-tertiary);
}

.field-input:focus {
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ═══════════════════════════════════
   错误提示
   ═══════════════════════════════════ */
.error-msg {
  color: var(--error);
  font-size: 13px;
  margin: -8px 0 16px;
  text-align: center;
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes shake {

  0%,
  100% {
    transform: translateX(0);
  }

  15% {
    transform: translateX(-6px);
  }

  30% {
    transform: translateX(5px);
  }

  45% {
    transform: translateX(-4px);
  }

  60% {
    transform: translateX(3px);
  }

  75% {
    transform: translateX(-2px);
  }

  90% {
    transform: translateX(1px);
  }
}

.error-shake-enter-active {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

.error-shake-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.error-shake-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ═══════════════════════════════════
   登录按钮
   ═══════════════════════════════════ */
.login-btn {
  position: relative;
  width: 100%;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0.06em;
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #c9975c, #b8864a);
  transition: transform 0.2s ease, box-shadow 0.3s ease;
  overflow: hidden;
  animation: fieldEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: 0.45s;
}

.login-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #d4a862, #c09050);
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: inherit;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 24px rgba(201, 151, 92, 0.4);
}

.login-btn:hover:not(:disabled)::before {
  opacity: 1;
}

.login-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-btn .btn-text,
.login-btn .btn-loading {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* ───── 加载旋转 ───── */
.spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-loading span {
  font-size: 14px;
  letter-spacing: 0.04em;
}

/* ═══════════════════════════════════
   卡片切换过渡
   ═══════════════════════════════════ */
.card-swap-enter-active {
  animation: cardEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.card-swap-leave-active {
  animation: cardLeave 0.3s cubic-bezier(0.55, 0, 1, 0.45) both;
}

@keyframes cardLeave {
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
}

/* ═══════════════════════════════════
   登录成功主页
   ═══════════════════════════════════ */
.home-card {
  text-align: center;
  padding: 36px 24px 32px;
}

.avatar-ring {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--accent), #d4a862, #b8864a, #c9975c);
  padding: 3px;
  margin-bottom: 16px;
  box-shadow: 0 0 20px rgba(201, 151, 92, 0.2);
  animation: avatarEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both, ringSpin 6s linear infinite;
}

@keyframes avatarEnter {
  from {
    opacity: 0;
    transform: scale(0.5);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes ringSpin {
  to {
    transform: rotate(360deg);
  }
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #fff;
  color: var(--accent);
  font-size: 26px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 16px;
  letter-spacing: 0.02em;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 28px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-item svg {
  opacity: 0.6;
  flex-shrink: 0;
}

/* ───── 主页按钮 ───── */
.home-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.action-btn.primary {
  background: linear-gradient(135deg, #c9975c, #b8864a);
  color: #fff;
  border: none;
  letter-spacing: 0.03em;
}

.action-btn.primary:hover {
  box-shadow: 0 4px 24px rgba(201, 151, 92, 0.4);
  transform: translateY(-1px);
}

.action-btn.primary:active {
  transform: translateY(0) scale(0.98);
}

.action-btn.ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--card-border);
  letter-spacing: 0.02em;
}

.action-btn.ghost:hover {
  color: var(--error);
  border-color: rgba(232, 80, 80, 0.25);
  background: rgba(232, 80, 80, 0.04);
}

.action-btn svg {
  flex-shrink: 0;
}

/* ═══════════════════════════════════
   选中 & 自动填充
   ═══════════════════════════════════ */
.field-input:-webkit-autofill,
.field-input:-webkit-autofill:hover,
.field-input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--text-primary);
  -webkit-box-shadow: 0 0 0 30px #f7f5f2 inset !important;
  caret-color: var(--accent);
}

::selection {
  background: rgba(201, 151, 92, 0.25);
  color: var(--text-primary);
}
</style>