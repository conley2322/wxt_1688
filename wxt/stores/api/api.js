import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useApiStore = defineStore('api', () => {

  // ══════════════════════════════════════
  // 当前用户
  // ══════════════════════════════════════
  const currentUser = ref({ name: '', initial: '?', color: '#ff6a00' })

  // ══════════════════════════════════════
  // 当前查看的商品/供应商
  // ══════════════════════════════════════
  const currentOfferId = ref('')
  const currentSupplierName = ref('')

  // ══════════════════════════════════════
  // 全局标签池
  // ══════════════════════════════════════
  const tagPool = ref([])

  // ══════════════════════════════════════
  // 商品标签（当前查看的商品）
  // ══════════════════════════════════════
  const productTagsMine = ref([])
  const productTagsOthers = ref([])
  const productAssignedTags = computed(() => [...productTagsMine.value, ...productTagsOthers.value])
  const productAvailableTags = computed(() =>
    tagPool.value.filter(t => !productAssignedTags.value.some(at => at.id === t.id))
  )

  // ══════════════════════════════════════
  // 供应商标签（当前查看的供应商）
  // ══════════════════════════════════════
  const supplierTagsMine = ref([])
  const supplierTagsOthers = ref([])
  const supplierAssignedTags = computed(() => [...supplierTagsMine.value, ...supplierTagsOthers.value])
  const supplierAvailableTags = computed(() =>
    tagPool.value.filter(t => !supplierAssignedTags.value.some(at => at.id === t.id))
  )

  // ══════════════════════════════════════
  // 供应商合作状态
  // ══════════════════════════════════════
  const supplierCooperated = ref(false)

  // ══════════════════════════════════════
  // 商品评论
  // ══════════════════════════════════════
  const productComments = ref([])

  // ══════════════════════════════════════
  // 供应商评论
  // ══════════════════════════════════════
  const supplierComments = ref([])

  // ══════════════════════════════════════
  // AJAX 封装（通过 background 代理，绕过混合内容限制）
  // ══════════════════════════════════════
  async function ajax(url, method, body) {
    const stored = await browser.storage.local.get(['token', 'username', 'serverAddress'])
    if (!stored.token) {
      throw new Error('未登录')
    }

    const fullUrl = stored.serverAddress + url
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${stored.token}`
    }

    const response = await browser.runtime.sendMessage({
      type: 'api-request',
      url: fullUrl,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })

    if (!response) {
      throw new Error('请求失败：无响应')
    }
    if (response.error) {
      throw new Error(response.error)
    }
    if (response.status === 401) {
      alert('登录已过期，请重新登录')
      throw new Error('登录已过期')
    }

    const data = response.data
    if (response.status !== 200 || data?.code !== 200) {
      throw new Error(data?.message || '请求失败')
    }
    return data
  }

  // ══════════════════════════════════════
  // 初始化用户
  // ══════════════════════════════════════
  async function initUser() {
    const stored = await browser.storage.local.get(['username'])
    if (stored.username) {
      currentUser.value.name = stored.username
      currentUser.value.initial = stored.username.charAt(0).toUpperCase()
    }
  }

  // ══════════════════════════════════════
  // 供应商创建
  // ══════════════════════════════════════
  async function createSupplier(name, memberId) {
    return await ajax('/api/v1/suppliers', 'POST', { name, memberId })
  }

  // ══════════════════════════════════════
  // 浏览记录
  // ══════════════════════════════════════
  async function recordBrowsing(offer_id, title, main_img_url, supplier_name) {
    return await ajax('/api/v1/products/Product_browsing_history', 'POST', {
      offer_id, title, main_img_url, supplier_name
    })
  }

  // ══════════════════════════════════════
  // 商品入库
  // ══════════════════════════════════════
  async function insertProduct(offer_id, title, main_img_url, supplier_name) {
    return await ajax('/api/v1/products', 'POST', { offer_id, title, main_img_url, supplier_name })
  }

  // ══════════════════════════════════════
  // 标签操作
  // ══════════════════════════════════════
  async function deleteTag(tag_id) {
    await ajax(`/api/v1/tags/${tag_id}`, 'DELETE')
    await fetchTagPool()
  }

  // ══════════════════════════════════════
  // 标签池
  // ══════════════════════════════════════
  async function fetchTagPool() {
    const res = await ajax('/api/v1/tags/pool', 'GET')
    tagPool.value = res.data
    return res.data
  }

  async function createTag(text, font_color, bg_color, visibility) {
    const res = await ajax('/api/v1/tags', 'POST', {
      text,
      font_color: font_color || '#fff',
      bg_color: bg_color || '#1677ff',
      visibility: visibility || 'public'
    })
    // 刷新标签池
    await fetchTagPool()
    return res.data
  }

  // ══════════════════════════════════════
  // 商品评论
  // ══════════════════════════════════════
  async function fetchProductComments(offer_id) {
    const res = await ajax(`/api/v1/products/${offer_id}/comments`, 'GET')
    productComments.value = res.data
    return res.data
  }

  async function addProductComment(offer_id, text) {
    const res = await ajax(`/api/v1/products/${offer_id}/comments`, 'POST', { text })
    await fetchProductComments(offer_id)
    return res.data
  }

  async function deleteProductComment(comment_id) {
    const res = await ajax(`/api/v1/products/comments/${comment_id}`, 'DELETE')
    return res
  }

  // ══════════════════════════════════════
  // 商品标签
  // ══════════════════════════════════════
  async function fetchProductTags(offer_id) {
    const res = await ajax(`/api/v1/products/${offer_id}/tags`, 'GET')
    productTagsMine.value = res.data.mine
    productTagsOthers.value = res.data.others
    return res.data
  }

  async function assignProductTag(offer_id, tag_id) {
    const res = await ajax(`/api/v1/products/${offer_id}/tags`, 'POST', { tag_id })
    await fetchProductTags(offer_id)
    return res
  }

  async function removeProductTag(offer_id, tag_id) {
    const res = await ajax(`/api/v1/products/${offer_id}/tags/${tag_id}`, 'DELETE')
    await fetchProductTags(offer_id)
    return res
  }

  // ══════════════════════════════════════
  // 供应商评论
  // ══════════════════════════════════════
  async function fetchSupplierComments(supplier_name) {
    const res = await ajax(`/api/v1/suppliers/comments?supplier_name=${encodeURIComponent(supplier_name)}`, 'GET')
    supplierComments.value = res.data
    return res.data
  }

  async function addSupplierComment(supplier_name, text) {
    const res = await ajax('/api/v1/suppliers/comments', 'POST', { supplier_name, text })
    await fetchSupplierComments(supplier_name)
    return res.data
  }

  async function updateSupplierComment(comment_id, text) {
    const res = await ajax(`/api/v1/suppliers/comments/${comment_id}`, 'PUT', { text })
    // 触发 reactivity: 直接修改本地列表中的评论文本
    const idx = supplierComments.value.findIndex(c => c.id === comment_id)
    if (idx !== -1) {
      const updated = { ...supplierComments.value[idx], text, updated_at: res.data?.updated_at || new Date().toISOString() }
      supplierComments.value.splice(idx, 1, updated)
    }
    return res
  }

  async function updateProductComment(comment_id, text) {
    const res = await ajax(`/api/v1/products/comments/${comment_id}`, 'PUT', { text })
    // 触发 reactivity: 直接修改本地列表中的评论文本
    const idx = productComments.value.findIndex(c => c.id === comment_id)
    if (idx !== -1) {
      const updated = { ...productComments.value[idx], text, updated_at: res.data?.updated_at || new Date().toISOString() }
      productComments.value.splice(idx, 1, updated)
    }
    return res
  }

  async function deleteSupplierComment(comment_id) {
    const res = await ajax(`/api/v1/suppliers/comments/${comment_id}`, 'DELETE')
    return res
  }

  // ══════════════════════════════════════
  // 供应商标签
  // ══════════════════════════════════════
  async function fetchSupplierTags(supplier_name) {
    const res = await ajax(`/api/v1/suppliers/tags?supplier_name=${encodeURIComponent(supplier_name)}`, 'GET')
    supplierTagsMine.value = res.data.mine
    supplierTagsOthers.value = res.data.others
    return res.data
  }

  async function assignSupplierTag(supplier_name, tag_id) {
    const res = await ajax('/api/v1/suppliers/tags', 'POST', { supplier_name, tag_id })
    await fetchSupplierTags(supplier_name)
    return res
  }

  async function removeSupplierTag(supplier_name, tag_id) {
    const res = await ajax(`/api/v1/suppliers/tags/${tag_id}?supplier_name=${encodeURIComponent(supplier_name)}`, 'DELETE')
    await fetchSupplierTags(supplier_name)
    return res
  }

  // ══════════════════════════════════════
  // 供应商合作
  // ══════════════════════════════════════
  async function toggleCooperate(supplier_name) {
    const res = await ajax('/api/v1/suppliers/cooperate', 'POST', { supplier_name })
    supplierCooperated.value = res.data.cooperated
    return res.data
  }

  async function fetchCooperateStatus(supplier_name) {
    try {
      const res = await ajax(`/api/v1/suppliers/cooperate/status?supplier_name=${encodeURIComponent(supplier_name)}`, 'GET')
      supplierCooperated.value = res.data.cooperated
    } catch {
      supplierCooperated.value = false
    }
  }

  // ══════════════════════════════════════
  // Box 批量查询
  // ══════════════════════════════════════
  async function fetchBatchInfo(offer_ids) {
    const res = await ajax('/api/v1/products/batch_info', 'POST', { offer_ids })
    return res.data
  }

  return {
    // state
    currentUser,
    currentOfferId,
    currentSupplierName,
    tagPool,
    productTagsMine,
    productTagsOthers,
    productAssignedTags,
    productAvailableTags,
    supplierTagsMine,
    supplierTagsOthers,
    supplierAssignedTags,
    supplierAvailableTags,
    supplierCooperated,
    productComments,
    supplierComments,

    // ajax
    ajax,
    initUser,

    // 浏览 & 入库
    recordBrowsing,
    insertProduct,
    createSupplier,

    // 标签操作
    deleteTag,

    // 标签池
    fetchTagPool,
    createTag,

    // 商品评论
    fetchProductComments,
    addProductComment,
    updateProductComment,
    deleteProductComment,

    // 商品标签
    fetchProductTags,
    assignProductTag,
    removeProductTag,

    // 供应商评论
    fetchSupplierComments,
    addSupplierComment,
    updateSupplierComment,
    deleteSupplierComment,

    // 供应商标签
    fetchSupplierTags,
    assignSupplierTag,
    removeSupplierTag,

    // 供应商合作
    toggleCooperate,
    fetchCooperateStatus,

    // Box 批量
    fetchBatchInfo,
  }
})
