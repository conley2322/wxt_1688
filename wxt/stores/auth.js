import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getProfile, saveProfile } from '../utils/localdb.js'

// 单机版：没有账号体系，本地个人资料（昵称 + 通用头像，可改名换色）
export const useAuthStore = defineStore('auth', () => {
  const nickname = ref('')
  const avatarColor = ref('#8a8f99')
  const ready = ref(false)

  /** 初始化：读取（或首次创建）本地资料 */
  async function restoreSession() {
    const p = await getProfile()
    nickname.value = p.nickname
    avatarColor.value = p.avatar_color
    ready.value = true
  }

  async function save(patch) {
    const p = await saveProfile(patch)
    nickname.value = p.nickname
    avatarColor.value = p.avatar_color
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
