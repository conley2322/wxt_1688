import { defineStore } from 'pinia'
import { ref } from 'vue'
import store from '../../utils/storage.js'

export const useAuthStore = defineStore('auth', () => {
  const serverAddress = ref('')
  const username = ref('')
  const token = ref('')
  const isLoggedIn = ref(false)
  const loading = ref(false)
  const error = ref('')

  const STORAGE_KEY = 'auth_session'

  async function restoreSession() {
    try {
      const stored = await store.get(STORAGE_KEY)
      const session = stored[STORAGE_KEY]
      if (session?.token && session?.username) {
        token.value = session.token
        username.value = session.username
        serverAddress.value = session.serverAddress || ''
        isLoggedIn.value = true
      }
    } catch (e) {
      console.warn('恢复登录状态失败:', e)
    }
  }

  async function saveToStorage() {
    await store.set({
      [STORAGE_KEY]: {
        token: token.value,
        username: username.value,
        serverAddress: serverAddress.value,
      }
    })
  }

  async function clearStorage() {
    await store.remove(STORAGE_KEY)
  }

  /**
   * @param {string} server - 服务器地址，如 "192.168.1.100:3000"
   * @param {string} user - 用户名
   * @param {string} password - 密码
   */
  async function login(server, user, password) {
    loading.value = true
    error.value = ''

    try {
      const baseUrl = server.startsWith('http') ? server : `http://${server}`
      const res = await fetch(`${baseUrl}/api/v1/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password }),
      })

      const data = await res.json()

      if (!res.ok || data.code !== 200) {
        throw new Error(data.message || '登录失败')
      }

      serverAddress.value = baseUrl
      username.value = data.data.user.username
      token.value = data.data.token
      isLoggedIn.value = true

      await saveToStorage()
    } catch (e) {
      error.value = e.message || '登录失败，请重试'
      isLoggedIn.value = false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    token.value = ''
    username.value = ''
    isLoggedIn.value = false
    error.value = ''
    await clearStorage()
  }

  function clearError() {
    error.value = ''
  }

  /**
   * 通用 API 请求方法，自动拼接 serverAddress
   */
  async function request(path, options = {}) {
    const url = `${serverAddress.value}${path}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    const res = await fetch(url, { ...options, headers })
    return res.json()
  }

  return {
    serverAddress,
    username,
    token,
    isLoggedIn,
    loading,
    error,
    restoreSession,
    login,
    logout,
    clearError,
    request,
  }
})