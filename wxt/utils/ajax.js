/**
 * Ajax 请求工具，基于 fetch 封装
 * baseUrl 由调用方传入（来自 auth store 的 serverAddress）
 */
import store from './storage.js'

export async function ajaxGet() {
    const { token, username, serverAddress } = await store.get(['token', 'username', 'serverAddress'])
    console.log(serverAddress)
}

