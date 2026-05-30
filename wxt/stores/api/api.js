import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useApiStore = defineStore('api', () => {

  // ── 当前用户 ──
  const currentUser = ref({ name: 'Conley', initial: 'C', color: '#ff6a00' })

  // ── 全局标签池 ──
  let tagIdCounter = 8
  const userTagPool = ref([
    { id: 'tag_1', text: '可深度合作', font_color: '#fff', bg_color: '#2ecc71', visibility: 'public', creator: 'Conley', created_at: '2026-05-10T08:00:00Z' },
    { id: 'tag_2', text: '价格偏高', font_color: '#fff', bg_color: '#ff6a00', visibility: 'public', creator: 'Conley', created_at: '2026-05-11T10:00:00Z' },
    { id: 'tag_3', text: '交期长', font_color: '#fff', bg_color: '#e74c3c', visibility: 'public', creator: 'Conley', created_at: '2026-05-12T09:00:00Z' },
    { id: 'tag_4', text: '已测样品', font_color: '#fff', bg_color: '#3498db', visibility: 'public', creator: 'Conley', created_at: '2026-05-13T14:00:00Z' },
    { id: 'tag_5', text: '响应快', font_color: '#fff', bg_color: '#1abc9c', visibility: 'public', creator: 'Conley', created_at: '2026-05-14T11:00:00Z' },
    { id: 'tag_6', text: '优质供应商', font_color: '#fff', bg_color: '#2ecc71', visibility: 'public', creator: '张三', created_at: '2026-05-15T08:30:00Z' },
    { id: 'tag_7', text: '包装破损', font_color: '#fff', bg_color: '#9b59b6', visibility: 'private', creator: 'Conley', created_at: '2026-05-16T16:00:00Z' },
    { id: 'tag_8', text: '物流快', font_color: '#fff', bg_color: '#f39c12', visibility: 'public', creator: 'Conley', created_at: '2026-05-17T10:00:00Z' },
  ])

  // ── 商品已分配标签 ──
  const productAssignedTags = ref([
    { id: 'tag_1', text: '可深度合作', font_color: '#fff', bg_color: '#2ecc71', visibility: 'public', creator: 'Conley', created_at: '2026-05-10T08:00:00Z', like_count: 2, added_by: 'Conley' },
    { id: 'tag_2', text: '价格偏高', font_color: '#fff', bg_color: '#ff6a00', visibility: 'public', creator: 'Conley', created_at: '2026-05-11T10:00:00Z', like_count: 1, added_by: 'Conley' },
  ])

  // ── 商品可用标签 ──
  const productAvailableTags = computed(() =>
    userTagPool.value.filter(ut => !productAssignedTags.value.some(at => at.id === ut.id))
  )

  // ── 供应商已分配标签 ──
  const supplierAssignedTags = ref([
    { id: 'tag_6', text: '优质供应商', font_color: '#fff', bg_color: '#2ecc71', visibility: 'public', creator: '张三', created_at: '2026-05-15T08:30:00Z', like_count: 5, added_by: 'Conley' },
    { id: 'tag_3', text: '交期长', font_color: '#fff', bg_color: '#e74c3c', visibility: 'public', creator: 'Conley', created_at: '2026-05-12T09:00:00Z', like_count: 3, added_by: 'Conley' },
    { id: 'tag_5', text: '响应快', font_color: '#fff', bg_color: '#1abc9c', visibility: 'public', creator: 'Conley', created_at: '2026-05-14T11:00:00Z', like_count: 1, added_by: 'Conley' },
  ])

  // ── 供应商可用标签 ──
  const supplierAvailableTags = computed(() =>
    userTagPool.value.filter(ut => !supplierAssignedTags.value.some(at => at.id === ut.id))
  )

  // ── 供应商合作状态 ──
  const supplierCooperated = ref(false)

  // ── Tag 操作方法 ──
  function createTag(text, fontColor, bgColor, visibility) {
    const tag = {
      id: `tag_${++tagIdCounter}`,
      text,
      font_color: fontColor,
      bg_color: bgColor,
      visibility,
      creator: currentUser.value.name,
      created_at: new Date().toISOString(),
    }
    userTagPool.value.push(tag)
    return tag
  }

  function deleteTag(tagId) {
    userTagPool.value = userTagPool.value.filter(t => t.id !== tagId)
    productAssignedTags.value = productAssignedTags.value.filter(t => t.id !== tagId)
    supplierAssignedTags.value = supplierAssignedTags.value.filter(t => t.id !== tagId)
  }

  function assignTagToProduct(tagId) {
    const tag = userTagPool.value.find(t => t.id === tagId)
    if (!tag || productAssignedTags.value.some(t => t.id === tagId)) return
    productAssignedTags.value.push({ ...tag, like_count: 1, added_by: currentUser.value.name })
  }

  function removeTagFromProduct(tagId) {
    productAssignedTags.value = productAssignedTags.value.filter(t => t.id !== tagId)
  }

  function likeProductTag(tagId) {
    const tag = productAssignedTags.value.find(t => t.id === tagId)
    if (tag) tag.like_count++
  }

  function unlikeProductTag(tagId) {
    const tag = productAssignedTags.value.find(t => t.id === tagId)
    if (tag && tag.like_count > 0) tag.like_count--
  }

  function assignTagToSupplier(tagId) {
    const tag = userTagPool.value.find(t => t.id === tagId)
    if (!tag || supplierAssignedTags.value.some(t => t.id === tagId)) return
    supplierAssignedTags.value.push({ ...tag, like_count: 1, added_by: currentUser.value.name })
  }

  function removeTagFromSupplier(tagId) {
    supplierAssignedTags.value = supplierAssignedTags.value.filter(t => t.id !== tagId)
  }

  function likeSupplierTag(tagId) {
    const tag = supplierAssignedTags.value.find(t => t.id === tagId)
    if (tag) tag.like_count++
  }

  function unlikeSupplierTag(tagId) {
    const tag = supplierAssignedTags.value.find(t => t.id === tagId)
    if (tag && tag.like_count > 0) tag.like_count--
  }

  function toggleCooperation() {
    supplierCooperated.value = !supplierCooperated.value
  }

  // ── 评论相关 ──
  let commentIdCounter = 4
  const productComments = ref([
    { id: 'cmt_1', user_name: 'Conley', initial: 'C', color: '#ff6a00', text: '这个供应商质量不错，价格适中，交期稳定', created_at: '2026-05-24T10:30:00Z', likes: 3, liked_by: ['张三', '李四', 'Alex'] },
    { id: 'cmt_2', user_name: '张三', initial: '张', color: '#2ecc71', text: '价格偏高，但交期准时，注意核对包装规格', created_at: '2026-05-21T08:15:00Z', likes: 5, liked_by: ['Conley', '李四'] },
    { id: 'cmt_3', user_name: '李四', initial: '李', color: '#3498db', text: '注意尺寸偏差，上次打版退了100个，建议先拿样品测试再批量', created_at: '2026-05-18T14:20:00Z', likes: 8, liked_by: ['Conley', '张三', 'Alex'] },
    { id: 'cmt_4', user_name: 'Alex', initial: 'A', color: '#9b59b6', text: '包装太简陋容易破损，需加固，不然运输中容易损坏产品', created_at: '2026-05-10T09:00:00Z', likes: 2, liked_by: ['Conley'] },
  ])

  let supplierCommentIdCounter = 5
  const supplierComments = ref([
    { id: 'scmt_1', user_name: 'Conley', initial: 'C', color: '#ff6a00', text: '合作了3年质量稳定，值得长期合作', created_at: '2026-01-15T10:00:00Z', likes: 6, liked_by: ['张三', '李四'] },
    { id: 'scmt_2', user_name: '张三', initial: '张', color: '#2ecc71', text: '交期偶尔延误但沟通顺畅，总体满意', created_at: '2026-02-18T11:30:00Z', likes: 3, liked_by: ['Conley'] },
    { id: 'scmt_3', user_name: '李四', initial: '李', color: '#3498db', text: '价格有优势但注意核对包装规格，上次发错一批', created_at: '2026-03-22T16:00:00Z', likes: 4, liked_by: ['Conley', '张三'] },
    { id: 'scmt_4', user_name: 'Alex', initial: 'A', color: '#9b59b6', text: '验厂通过设备先进，已列为合格供应商', created_at: '2026-04-10T09:30:00Z', likes: 2, liked_by: ['Conley'] },
    { id: 'scmt_5', user_name: 'Tom', initial: 'T', color: '#e74c3c', text: '售后处理及时，退换货3天解决', created_at: '2026-05-05T14:00:00Z', likes: 1, liked_by: ['李四'] },
  ])

  function addProductComment(text) {
    productComments.value.unshift({
      id: `cmt_${++commentIdCounter}`,
      user_name: currentUser.value.name,
      initial: currentUser.value.initial,
      color: currentUser.value.color,
      text,
      created_at: new Date().toISOString(),
      likes: 0,
      liked_by: [],
    })
  }

  function toggleLike(commentId) {
    const cmt = productComments.value.find(c => c.id === commentId)
    if (!cmt) return
    const idx = cmt.liked_by.indexOf(currentUser.value.name)
    if (idx === -1) {
      cmt.liked_by.push(currentUser.value.name)
      cmt.likes++
    } else {
      cmt.liked_by.splice(idx, 1)
      cmt.likes--
    }
  }

  function addSupplierComment(text) {
    supplierComments.value.unshift({
      id: `scmt_${++supplierCommentIdCounter}`,
      user_name: currentUser.value.name,
      initial: currentUser.value.initial,
      color: currentUser.value.color,
      text,
      created_at: new Date().toISOString(),
      likes: 0,
      liked_by: [],
    })
  }

  function toggleSupplierLike(commentId) {
    const cmt = supplierComments.value.find(c => c.id === commentId)
    if (!cmt) return
    const idx = cmt.liked_by.indexOf(currentUser.value.name)
    if (idx === -1) {
      cmt.liked_by.push(currentUser.value.name)
      cmt.likes++
    } else {
      cmt.liked_by.splice(idx, 1)
      cmt.likes--
    }
  }

  async function ajax(url, method, body) {
    const stored = await browser.storage.local.get(['token', 'username', 'serverAddress'])
    if (!stored.token) {
      throw new Error('未登录')
    }
    console.log('已登入可以发送请求')
    console.log('ajax: 开始 发送请求', url, method, body)
    try {
      const fullUrl = stored.serverAddress + url
      console.log('ajax: 完整URL', fullUrl)
      const res = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${stored.token}`
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      return data
    } catch (error) {
      console.error('请求失败:', error)
    }
  }

  return {
    ajax,
    currentUser,
    userTagPool,
    productAssignedTags,
    productAvailableTags,
    supplierAssignedTags,
    supplierAvailableTags,
    createTag,
    deleteTag,
    assignTagToProduct,
    removeTagFromProduct,
    likeProductTag,
    unlikeProductTag,
    assignTagToSupplier,
    removeTagFromSupplier,
    likeSupplierTag,
    unlikeSupplierTag,
    productComments,
    supplierComments,
    addProductComment,
    toggleLike,
    addSupplierComment,
    toggleSupplierLike,
    supplierCooperated,
    toggleCooperation,
  }
})
