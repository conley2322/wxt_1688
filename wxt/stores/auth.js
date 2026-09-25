import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api as dataApi } from '../utils/dataClient.js'

// 单机版：没有账号体系，本地个人资料（昵称 + 通用头像，可改名换色）
// 通过 background 消息读写，保证与详情页/列表页/管理后台同一份数据
export const useAuthStore = defineStore('auth', () => {
  const nickname = ref('我')
  const avatarColor = ref('#8a8f99')
  const ready = ref(false)

  /** 初始化：读取（或首次创建）本地资料 */
  async function restoreSession() {
    const res = await dataApi('/api/v1/users', 'GET')
    const p = res.code === 200 && res.data[0] ? res.data[0] : { nickname: '我', avatar_color: '#8a8f99' }
    nickname.value = p.nickname || p.username || '我'
    avatarColor.value = p.avatar_color || '#8a8f99'
    ready.value = true
  }

  async function save(patch) {
    const res = await dataApi('/api/v1/users/profile', 'PUT', patch)
    const p = res.code === 200 && res.data ? res.data : {}
    nickname.value = p.nickname || p.username || nickname.value
    avatarColor.value = p.avatar_color || avatarColor.value
    return p
  }

  // 兼容旧调用：win/App.vue 挂载时会调 initUser
  async function initUser() {
    await restoreSession()
  }

  return {
    nickname,
    avatarColor,
    ready,
    restoreSession,
    save,
    initUser,
  }
})
