// 单机版：所有 /api/v1/* 请求在本地 IndexedDB 上执行，无网络
import { handle as localHandle } from '../../../utils/localapi.js'

export async function api(path, method, body) {
  const res = await localHandle(path, method, body)
  console.log('[Local API]', method, path)
  return res
}
