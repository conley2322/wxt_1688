import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useApiStore = defineStore('api', () => {
  // ── 公共数据 ──
  const currentUser = ref({ name: 'Conley', initial: 'C', color: '#ff6a00' })

  // ── 我的标签池（全局，创建后可重复分配到不同商品） ──
  const userTagPool = ref([
    { id: 'tag_1', text: '可深度合作', color: '#2ecc71', visible: true },
    { id: 'tag_2', text: '价格偏高', color: '#ff6a00', visible: true },
    { id: 'tag_3', text: '交期长', color: '#e74c3c', visible: true },
    { id: 'tag_4', text: '已测样品', color: '#3498db', visible: true },
    { id: 'tag_5', text: '响应快', color: '#1abc9c', visible: true },
    { id: 'tag_6', text: '优质供应商', color: '#2ecc71', visible: true },
    { id: 'tag_7', text: '包装破损', color: '#9b59b6', visible: false },
    { id: 'tag_8', text: '物流快', color: '#f39c12', visible: true },
  ])

  let tagIdCounter = 100

  function createTag(text, color, visible) {
    const tag = { id: `tag_${++tagIdCounter}`, text, color, visible }
    userTagPool.value.push(tag)
    return tag
  }

  function deleteTag(tagId) {
    const idx = userTagPool.value.findIndex(t => t.id === tagId)
    if (idx !== -1) userTagPool.value.splice(idx, 1)
    // 同时从所有已分配列表中移除
    productAssignedTags.value = productAssignedTags.value.filter(t => t.id !== tagId)
    supplierAssignedTags.value = supplierAssignedTags.value.filter(t => t.id !== tagId)
  }

  function updateTag(tagId, updates) {
    const tag = userTagPool.value.find(t => t.id === tagId)
    if (tag) Object.assign(tag, updates)
  }

  // ── 商品已分配标签 ──
  const productAssignedTags = ref([
    { id: 'tag_1', text: '可深度合作', color: '#2ecc71', visible: true, added_by: 'Conley' },
    { id: 'tag_2', text: '价格偏高', color: '#ff6a00', visible: true, added_by: 'Conley' },
  ])

  // 未分配给当前商品的标签（我的标签池过滤）
  const productAvailableTags = computed(() =>
    userTagPool.value.filter(ut => !productAssignedTags.value.some(at => at.id === ut.id))
  )

  function assignTagToProduct(tagId) {
    const tag = userTagPool.value.find(t => t.id === tagId)
    if (tag && !productAssignedTags.value.some(t => t.id === tagId)) {
      productAssignedTags.value.push({ ...tag, added_by: currentUser.value.name })
    }
  }

  function removeTagFromProduct(tagId) {
    productAssignedTags.value = productAssignedTags.value.filter(t => t.id !== tagId)
  }

  function toggleTagVisibility(tagId) {
    const tag = productAssignedTags.value.find(t => t.id === tagId)
    if (tag) tag.visible = !tag.visible
  }

  // ── 供应商已分配标签 ──
  const supplierAssignedTags = ref([
    { id: 'tag_6', text: '优质供应商', color: '#2ecc71', visible: true, added_by: 'Conley' },
    { id: 'tag_3', text: '交期长', color: '#e74c3c', visible: true, added_by: 'Conley' },
    { id: 'tag_5', text: '响应快', color: '#1abc9c', visible: true, added_by: 'Conley' },
  ])

  const supplierAvailableTags = computed(() =>
    userTagPool.value.filter(ut => !supplierAssignedTags.value.some(at => at.id === ut.id))
  )

  function assignTagToSupplier(tagId) {
    const tag = userTagPool.value.find(t => t.id === tagId)
    if (tag && !supplierAssignedTags.value.some(t => t.id === tagId)) {
      supplierAssignedTags.value.push({ ...tag, added_by: currentUser.value.name })
    }
  }

  function removeTagFromSupplier(tagId) {
    supplierAssignedTags.value = supplierAssignedTags.value.filter(t => t.id !== tagId)
  }

  function toggleSupplierTagVisibility(tagId) {
    const tag = supplierAssignedTags.value.find(t => t.id === tagId)
    if (tag) tag.visible = !tag.visible
  }

  // ── 商品评论 ──
  const productComments = ref([
    { id: 'cmt_1', user_name: 'Conley', initial: 'C', color: '#ff6a00', text: '这个供应商质量不错，价格适中，交期稳定', created_at: '2026-05-24T10:30:00Z', likes: 3, liked_by: ['张三', '李四', 'Alex'] },
    { id: 'cmt_2', user_name: '张三', initial: '张', color: '#2ecc71', text: '价格偏高，但交期准时，注意核对包装规格', created_at: '2026-05-21T08:15:00Z', likes: 5, liked_by: ['Conley', '李四'] },
    { id: 'cmt_3', user_name: '李四', initial: '李', color: '#3498db', text: '注意尺寸偏差，上次打版退了100个，建议先拿样品测试再批量', created_at: '2026-05-18T14:20:00Z', likes: 8, liked_by: ['Conley', '张三', 'Alex'] },
    { id: 'cmt_4', user_name: 'Alex', initial: 'A', color: '#9b59b6', text: '包装太简陋容易破损，需加固，不然运输中容易损坏产品', created_at: '2026-05-10T09:00:00Z', likes: 2, liked_by: ['Conley'] },
  ])

  let commentIdCounter = 100

  function addProductComment(text) {
    const now = new Date().toISOString()
    productComments.value.unshift({
      id: `cmt_${++commentIdCounter}`,
      user_name: currentUser.value.name,
      initial: currentUser.value.initial,
      color: currentUser.value.color,
      text,
      created_at: now,
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

  // ── 供应商评论 ──
  const supplierComments = ref([
    { id: 'scmt_1', user_name: 'Conley', initial: 'C', color: '#ff6a00', text: '合作了3年质量稳定，值得长期合作', created_at: '2026-01-15T10:00:00Z', likes: 6, liked_by: ['张三', '李四'] },
    { id: 'scmt_2', user_name: '张三', initial: '张', color: '#2ecc71', text: '交期偶尔延误但沟通顺畅，总体满意', created_at: '2026-02-18T11:30:00Z', likes: 3, liked_by: ['Conley'] },
    { id: 'scmt_3', user_name: '李四', initial: '李', color: '#3498db', text: '价格有优势但注意核对包装规格，上次发错一批', created_at: '2026-03-22T16:00:00Z', likes: 4, liked_by: ['Conley', '张三'] },
    { id: 'scmt_4', user_name: 'Alex', initial: 'A', color: '#9b59b6', text: '验厂通过设备先进，已列为合格供应商', created_at: '2026-04-10T09:30:00Z', likes: 2, liked_by: ['Conley'] },
    { id: 'scmt_5', user_name: 'Tom', initial: 'T', color: '#e74c3c', text: '售后处理及时，退换货3天解决', created_at: '2026-05-05T14:00:00Z', likes: 1, liked_by: ['李四'] },
  ])

  function addSupplierComment(text) {
    const now = new Date().toISOString()
    supplierComments.value.unshift({
      id: `scmt_${++commentIdCounter}`,
      user_name: currentUser.value.name,
      initial: currentUser.value.initial,
      color: currentUser.value.color,
      text,
      created_at: now,
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

  // ── 供应商合作状态 ──
  const supplierCooperated = ref(false)

  function toggleCooperation() {
    supplierCooperated.value = !supplierCooperated.value
  }

  // ── 商品概览数据 ──
  const productInfo = ref({
    title: '秋季新款男式PU皮衣男士西装皮夹克西服薄款休闲外套皮夹克男',
    supplier_name: '石狮市莫菲亚服装厂',
    image_url: 'https://quark-aistudio-cdn-v2.quark.cn/d%2Fzaodian%2Fbec54902ae288f75655d66664a9f4026%2F1768122209305-7dab0b08a2db48a996dc245f44fb00fc.png?auth_key=1771744920-0-0-7342a9d93aa314d64b6d59a9afd7f9c2&x-oss-process=image/format,webp/resize,w_512',
    product_id: '773149563136',
  })

  // ── 浏览数据（只统计商品页面） ──
  const totalViews = ref(328)

  const viewerStats = ref([
    { name: 'Conley', initial: 'C', count: 118 },
    { name: '李四', initial: '李', count: 94 },
    { name: '张三', initial: '张', count: 62 },
    { name: 'Alex', initial: 'A', count: 54 },
  ])

  const viewerStatsWithPercent = computed(() => {
    const total = viewerStats.value.reduce((s, v) => s + v.count, 0)
    return viewerStats.value.map(v => ({
      ...v,
      percentage: total > 0 ? ((v.count / total) * 100).toFixed(1) : 0,
    }))
  })

  const viewRecords = ref([
    { user_name: 'Conley', initial: 'C', color: '#ff6a00', time: '2026-05-24 14:30' },
    { user_name: '李四', initial: '李', color: '#3498db', time: '2026-05-24 10:15' },
    { user_name: 'Conley', initial: 'C', color: '#ff6a00', time: '2026-05-23 16:45' },
    { user_name: '张三', initial: '张', color: '#2ecc71', time: '2026-05-22 09:20' },
    { user_name: 'Alex', initial: 'A', color: '#9b59b6', time: '2026-05-20 11:00' },
    { user_name: '李四', initial: '李', color: '#3498db', time: '2026-05-19 15:30' },
    { user_name: 'Conley', initial: 'C', color: '#ff6a00', time: '2026-05-18 08:00' },
  ])

  return {
    currentUser,
    userTagPool,
    createTag,
    deleteTag,
    updateTag,
    productAssignedTags,
    productAvailableTags,
    assignTagToProduct,
    removeTagFromProduct,
    toggleTagVisibility,
    supplierAssignedTags,
    supplierAvailableTags,
    assignTagToSupplier,
    removeTagFromSupplier,
    toggleSupplierTagVisibility,
    productComments,
    addProductComment,
    toggleLike,
    supplierComments,
    addSupplierComment,
    toggleSupplierLike,
    supplierCooperated,
    toggleCooperation,
    productInfo,
    totalViews,
    viewerStats,
    viewerStatsWithPercent,
    viewRecords,
  }
})