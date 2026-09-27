import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api as dataApi } from '../../utils/dataClient.js'

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
  // 商品评论
  // ══════════════════════════════════════
  const productComments = ref([])

  // ══════════════════════════════════════
  // 供应商评论
  // ══════════════════════════════════════
  const supplierComments = ref([])

  // ══════════════════════════════════════
  // AJAX 封装（单机版：通过 background 消息读写扩展 origin 的唯一 IndexedDB）
  // ══════════════════════════════════════
  async function ajax(url, method, body) {
    const res = await dataApi(url, method, body)
    if (res.code === 401) {
      alert('本地数据访问异常，请重试')
      throw new Error('本地数据访问异常')
    }
    if (res.code !== 200) {
      throw new Error(res.message || '本地操作失败')
    }
    return res
  }

  // ══════════════════════════════════════
  // 初始化用户（单机版：读本地资料，经 background）
  // ══════════════════════════════════════
  async function initUser() {
    const res = await dataApi('/api/v1/users', 'GET')
    const me = res.code === 200 ? res.data[0] : null
    if (me) {
      currentUser.value.name = me.nickname || me.username
      currentUser.value.initial = (me.nickname || me.username || '?').charAt(0).toUpperCase()
      currentUser.value.color = me.avatar_color || '#8a8f99'
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
    productComments,
    supplierComments,

    // ajax
    ajax,
    initUser,

    // 浏览 & 入库
    recordBrowsing,
    insertProduct,
    createSupplier,

    // 商品评论
    fetchProductComments,
    addProductComment,
    updateProductComment,
    deleteProductComment,

    // 供应商评论
    fetchSupplierComments,
    addSupplierComment,
    updateSupplierComment,
    deleteSupplierComment,

    // Box 批量
    fetchBatchInfo,
  }
})
