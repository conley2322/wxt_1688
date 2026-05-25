# 1688 协作悬浮面板 — 布局重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 1688 产品详情页悬浮窗口，以产品概览+评论区为首屏，新增标签管理和数据分析页

**Architecture:** App.vue 管理主 Tab 和 SubTab 路由切换，评论/标签/分析页面均为独立路由组件。新构建的 pinia store 使用响应式数据支持增删改操作

**Tech Stack:** Vue 3 + Vue Router 4 + Pinia + ECharts

---

## 文件结构

### 新建文件 (11个)
| 文件 | 职责 |
|------|------|
| `wxt/entrypoints/win/components/CommentItem.vue` | 单条评论卡片（头像+名字+相对时间+正文+点赞） |
| `wxt/entrypoints/win/components/CommentInput.vue` | 底部固定输入框（头像+输入框+发送按钮） |
| `wxt/entrypoints/win/components/UserFilter.vue` | 用户多选筛选器（搜索+复选列表+应用按钮） |
| `wxt/entrypoints/win/components/TagChip.vue` | 标签组件（悬停操作浮层 + 右键菜单） |
| `wxt/entrypoints/win/pages/product/comment.vue` | 商品评论页（SubTab+搜索排序+评论列表+输入框） |
| `wxt/entrypoints/win/pages/product/tag.vue` | 商品标签页（已添加标签+我的标签池+创建表单） |
| `wxt/entrypoints/win/pages/supplier/comment.vue` | 供应商评论页（合作状态勾选+同商品评论布局） |
| `wxt/entrypoints/win/pages/supplier/tag.vue` | 供应商标签页（同商品标签布局，数据不同） |
| `wxt/entrypoints/win/pages/analysis/views.vue` | 浏览量环形图（ECharts） |
| `wxt/entrypoints/win/pages/analysis/records.vue` | 浏览记录列表 |

### 修改文件 (3个)
| 文件 | 修改内容 |
|------|---------|
| `wxt/entrypoints/win/App.vue` | 完全重写：产品概览区 + Tab栏 + SubTab栏 + router-view |
| `wxt/entrypoints/win/router.js` | 完全重写：新路由结构 |
| `wxt/entrypoints/stores/api/api.js` | 完全重写：响应式数据 + 新增标签/评论/浏览数据结构 |

### 删除文件 (8个)
| 文件 | 原因 |
|------|------|
| `wxt/entrypoints/win/pages/home/` (整个目录) | 功能被产品概览区+评论区取代 |
| `wxt/entrypoints/win/pages/offer/` (整个目录) | 拆分为 product/comment 和 product/tag |
| `wxt/entrypoints/win/pages/factory/` (整个目录) | 拆分为 supplier/comment 和 supplier/tag |
| `wxt/entrypoints/win/components/SubNav.vue` | 不再使用 |
| `wxt/entrypoints/win/components/tab.vue` | 不再使用 |

---

### Task 1: 安装 ECharts 并重写数据 Store

**Files:**
- Modify: `package.json`
- Modify: `wxt/entrypoints/stores/api/api.js`
- Create: `wxt/entrypoints/stores/api/api.js` (重写)

- [ ] **Step 1: 安装 echarts**

```bash
npm install echarts
```

- [ ] **Step 2: 重写 api.js store 为响应式数据**

关键设计：
- 所有数据使用 `ref()` 包裹，确保修改可触发视图更新
- 标签系统分为 `userTagPool`（我的标签池）和 `productTags`/`supplierTags`（已分配标签）
- 评论数据支持点赞 toggle
- 浏览数据统计和浏览记录

```javascript
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
```

- [ ] **Step 3: 验证 store 代码语法正确**

Run: `npm install`
Run: `npx wxt check` (或手动检查语法)

---

### Task 2: 重写路由

**Files:**
- Modify: `wxt/entrypoints/win/router.js`
- Delete afterwards: `wxt/entrypoints/win/pages/offer/`, `wxt/entrypoints/win/pages/factory/`, `wxt/entrypoints/win/pages/home/`

- [ ] **Step 1: 重写 router.js**

```javascript
import { createRouter, createMemoryHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/product/comment' },
  {
    path: '/product/comment',
    name: 'product-comment',
    component: () => import('./pages/product/comment.vue'),
  },
  {
    path: '/product/tag',
    name: 'product-tag',
    component: () => import('./pages/product/tag.vue'),
  },
  {
    path: '/supplier/comment',
    name: 'supplier-comment',
    component: () => import('./pages/supplier/comment.vue'),
  },
  {
    path: '/supplier/tag',
    name: 'supplier-tag',
    component: () => import('./pages/supplier/tag.vue'),
  },
  {
    path: '/analysis/views',
    name: 'analysis-views',
    component: () => import('./pages/analysis/views.vue'),
  },
  {
    path: '/analysis/records',
    name: 'analysis-records',
    component: () => import('./pages/analysis/records.vue'),
  },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router
```

- [ ] **Step 2: 验证路由文件语法**

---

### Task 3: 重写 App.vue（主布局）

**Files:**
- Modify: `wxt/entrypoints/win/App.vue`

这个任务工作量最大。App.vue 包含：拖拽标题栏、产品概览区、主 Tab 栏、SubTab 栏、router-view。

- [ ] **Step 1: 重写 App.vue 模板和逻辑**

```vue
<!-- win/App.vue - 重构后主布局 -->
<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DraggableWindow from './components/DraggableWindow.vue'
import HsAvatarStack from '../../components/HsAvatarStack.vue'
import { useApiStore } from '../stores/api/api.js'

const route = useRoute()
const router = useRouter()
const store = useApiStore()

// ── 判断当前 Tab ──
const currentTab = computed(() => {
  if (route.path.startsWith('/product')) return 'product'
  if (route.path.startsWith('/supplier')) return 'supplier'
  if (route.path.startsWith('/analysis')) return 'analysis'
  return 'product'
})

// ── SubTab 列表 ──
const subTabs = computed(() => {
  switch (currentTab.value) {
    case 'product':
      return [
        { path: '/product/comment', label: '评论' },
        { path: '/product/tag', label: '标签' },
      ]
    case 'supplier':
      return [
        { path: '/supplier/comment', label: '评论' },
        { path: '/supplier/tag', label: '标签' },
      ]
    case 'analysis':
      return [
        { path: '/analysis/views', label: '用户浏览量' },
        { path: '/analysis/records', label: '浏览记录' },
      ]
    default:
      return []
  }
})

// ── 导航到 Tab ──
function goToTab(tab) {
  switch (tab) {
    case 'product': router.push('/product/comment'); break
    case 'supplier': router.push('/supplier/comment'); break
    case 'analysis': router.push('/analysis/views'); break
  }
}

// ── 浏览次数汇总 ──
const totalViewCount = computed(() =>
  store.viewerStats.reduce((s, v) => s + v.count, 0)
)

// ── 头像栈数据 ──
const viewerAvatars = computed(() =>
  store.viewerStats.map(v => ({ initial: v.initial, tooltip: `${v.name} · ${v.count}次` }))
)

// ── 相对时间 ──
function timeAgo(isoStr) {
  const now = new Date()
  const t = new Date(isoStr)
  const diff = Math.floor((now - t) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}周前`
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${m}/${d}`
}

function isSubTabActive(path) {
  return route.path === path
}

function formatDate(dateStr) {
  return dateStr
}
</script>

<template>
  <DraggableWindow title="1688 协作">
    <!-- 产品概览区：左图右信息 -->
    <div class="product-overview">
      <img class="overview-thumb" :src="store.productInfo.image_url" alt="" />
      <div class="overview-info">
        <div class="overview-title" :title="store.productInfo.title">{{ store.productInfo.title }}</div>
        <div class="overview-supplier" :title="store.productInfo.supplier_name">{{ store.productInfo.supplier_name }}</div>
        <div class="overview-stats">
          <span class="view-count">👁 {{ totalViewCount }}次</span>
          <HsAvatarStack :viewers="viewerAvatars" :maxShow="3" variant="product" />
        </div>
      </div>
    </div>

    <!-- 主 Tab 栏 -->
    <div class="main-tabs">
      <span v-for="tab in [{ key: 'product', label: '商品' }, { key: 'supplier', label: '供应商' }, { key: 'analysis', label: '分析' }]"
        :key="tab.key"
        class="main-tab"
        :class="{ active: currentTab === tab.key }"
        @click="goToTab(tab.key)">
        {{ tab.label }}
      </span>
    </div>

    <!-- SubTab 栏 -->
    <div class="sub-tabs">
      <router-link v-for="st in subTabs" :key="st.path"
        :to="st.path"
        class="sub-tab"
        :class="{ active: isSubTabActive(st.path) }">
        {{ st.label }}
      </router-link>
    </div>

    <!-- 内容区 -->
    <div class="content-area">
      <router-view />
    </div>
  </DraggableWindow>
</template>

<style scoped>
/* ── 产品概览区 ── */
.product-overview {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}
.overview-thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.overview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.overview-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}
.overview-supplier {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}
.overview-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
}
.view-count {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
}

/* ── 主 Tab 栏 ── */
.main-tabs {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
}
.main-tab {
  flex: 1;
  text-align: center;
  padding: 7px 0;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.main-tab.active {
  color: #1677ff;
  font-weight: 600;
}
.main-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background: #1677ff;
}

/* ── SubTab 栏 ── */
.sub-tabs {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}
.sub-tab {
  flex: 1;
  text-align: center;
  padding: 6px 0;
  font-size: 12px;
  color: #999;
  text-decoration: none;
  transition: all 0.2s;
}
.sub-tab.active {
  color: #1677ff;
  font-weight: 500;
  background: #fff;
}

/* ── 内容区 ── */
.content-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.content-area::-webkit-scrollbar {
  width: 3px;
}
.content-area::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}
</style>
```

---

### Task 4: 构建评论相关组件

**Files:**
- Create: `wxt/entrypoints/win/components/CommentItem.vue`
- Create: `wxt/entrypoints/win/components/CommentInput.vue`
- Create: `wxt/entrypoints/win/components/UserFilter.vue`

- [ ] **Step 1: 创建 CommentItem.vue**

```vue
<template>
  <div class="comment-item">
    <div class="cmt-avatar" :style="{ background: comment.color }">{{ comment.initial }}</div>
    <div class="cmt-body">
      <div class="cmt-header">
        <span class="cmt-name">{{ comment.user_name }}</span>
        <span class="cmt-time">{{ timeAgo }}</span>
      </div>
      <div class="cmt-text">{{ comment.text }}</div>
      <div class="cmt-actions">
        <span class="cmt-like" :class="{ liked }" @click.stop="$emit('toggle-like', comment.id)">
          👍 {{ comment.likes > 0 ? comment.likes : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  comment: { type: Object, required: true },
  currentUser: { type: String, default: '' },
})

defineEmits(['toggle-like'])

const liked = computed(() =>
  props.comment.liked_by && props.comment.liked_by.includes(props.currentUser)
)

const timeAgo = computed(() => {
  const now = new Date()
  const t = new Date(props.comment.created_at)
  const diff = Math.floor((now - t) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}周前`
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${m}/${d}`
})
</script>

<style scoped>
.comment-item {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
}
.comment-item + .comment-item {
  border-top: 1px solid #f5f5f5;
}
.cmt-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.cmt-body {
  flex: 1;
  min-width: 0;
}
.cmt-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.cmt-name {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}
.cmt-time {
  font-size: 11px;
  color: #bbb;
}
.cmt-text {
  font-size: 13px;
  color: #1a1a1a;
  line-height: 1.5;
  word-break: break-word;
  margin-bottom: 4px;
}
.cmt-actions {
  display: flex;
  align-items: center;
}
.cmt-like {
  font-size: 12px;
  color: #999;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  user-select: none;
  transition: all 0.15s;
}
.cmt-like:hover {
  background: #fff0f0;
}
.cmt-like.liked {
  color: #ff6a00;
}
</style>
```

- [ ] **Step 2: 创建 CommentInput.vue**

```vue
<template>
  <div class="comment-input-wrap">
    <div class="input-avatar" :style="{ background: userColor }">{{ userInitial }}</div>
    <div class="input-area">
      <input
        ref="inputRef"
        class="input-field"
        v-model="text"
        :placeholder="placeholder"
        @keydown.enter="submit"
      />
    </div>
    <button class="send-btn" :disabled="!text.trim()" @click="submit">发送</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  userInitial: { type: String, default: 'C' },
  userColor: { type: String, default: '#ff6a00' },
  placeholder: { type: String, default: '输入评论...' },
})

const emit = defineEmits(['send'])
const text = ref('')
const inputRef = ref(null)

function submit() {
  const t = text.value.trim()
  if (!t) return
  emit('send', t)
  text.value = ''
  inputRef.value?.focus()
}
</script>

<style scoped>
.comment-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}
.input-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.input-area {
  flex: 1;
}
.input-field {
  width: 100%;
  border: none;
  outline: none;
  font-size: 13px;
  color: #333;
  background: #f5f5f5;
  border-radius: 16px;
  padding: 7px 12px;
  box-sizing: border-box;
}
.input-field::placeholder {
  color: #ccc;
}
.send-btn {
  flex-shrink: 0;
  border: none;
  background: #1677ff;
  color: #fff;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}
.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.send-btn:not(:disabled):hover {
  background: #4096ff;
}
</style>
```

- [ ] **Step 3: 创建 UserFilter.vue**

```vue
<template>
  <div class="user-filter">
    <div class="filter-trigger" @click.stop="open = !open">
      🔍
      <span class="filter-label">{{ selectedNames.length ? `已选${selectedNames.length}人` : '搜索用户' }}</span>
    </div>

    <Teleport to="body">
      <div v-if="open" class="filter-overlay" @click.stop="open = false">
        <div class="filter-dropdown" @click.stop>
          <input class="filter-search" v-model="searchText" placeholder="输入用户名..." />
          <div class="filter-list">
            <label v-for="u in filteredUsers" :key="u.name" class="filter-item">
              <input type="checkbox" :value="u.name" v-model="selectedNames" />
              <span class="filter-name">{{ u.name }}</span>
              <span class="filter-count">({{ u.count }}条)</span>
            </label>
          </div>
          <div class="filter-actions">
            <button class="filter-btn clear-btn" @click="selectedNames = []">清除</button>
            <button class="filter-btn apply-btn" @click="apply">应用筛选</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  users: { type: Array, required: true }, // [{ name, count }]
})

const emit = defineEmits(['apply'])

const open = ref(false)
const searchText = ref('')
const selectedNames = ref([])

const filteredUsers = computed(() => {
  if (!searchText.value.trim()) return props.users
  return props.users.filter(u => u.name.includes(searchText.value.trim()))
})

function apply() {
  emit('apply', [...selectedNames.value])
  open.value = false
}
</script>

<style scoped>
.user-filter {
  position: relative;
}
.filter-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
}
.filter-trigger:hover {
  background: #f0f0f0;
}
.filter-label {
  font-size: 11px;
  color: #999;
}
.filter-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.2);
}
.filter-dropdown {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  width: 240px;
  max-height: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.filter-search {
  border: none;
  border-bottom: 1px solid #f0f0f0;
  padding: 10px 12px;
  font-size: 13px;
  outline: none;
}
.filter-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.filter-item:hover {
  background: #f5f5f5;
}
.filter-name {
  color: #333;
}
.filter-count {
  color: #bbb;
  font-size: 11px;
}
.filter-actions {
  display: flex;
  border-top: 1px solid #f0f0f0;
}
.filter-btn {
  flex: 1;
  padding: 8px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.clear-btn {
  background: #fff;
  color: #999;
}
.clear-btn:hover {
  background: #f5f5f5;
}
.apply-btn {
  background: #1677ff;
  color: #fff;
}
.apply-btn:hover {
  background: #4096ff;
}
</style>
```

---

### Task 5: 构建商品评论页面

**Files:**
- Create: `wxt/entrypoints/win/pages/product/comment.vue`

- [ ] **Step 1: 创建 product/comment.vue**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useApiStore } from '../../stores/api/api.js'
import CommentItem from '../../components/CommentItem.vue'
import CommentInput from '../../components/CommentInput.vue'
import UserFilter from '../../components/UserFilter.vue'

const store = useApiStore()

// 排序：'newest' | 'oldest'
const sortOrder = ref('newest')

// 筛选用户列表（空 = 全部）
const filterUsers = ref([])

// 排序切换
function toggleSort() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}

const sortLabel = computed(() => sortOrder.value === 'newest' ? '最新' : '最早')

// 被筛选后的评论
const filteredComments = computed(() => {
  let list = [...store.productComments]
  if (filterUsers.value.length > 0) {
    list = list.filter(c => filterUsers.value.includes(c.user_name))
  }
  if (sortOrder.value === 'newest') {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  } else {
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }
  return list
})

// 用户列表（用于筛选器）
const userList = computed(() => {
  const map = {}
  store.productComments.forEach(c => {
    map[c.user_name] = (map[c.user_name] || 0) + 1
  })
  return Object.entries(map).map(([name, count]) => ({ name, count }))
})

function handleFilter(selected) {
  filterUsers.value = selected
}

function handleSend(text) {
  store.addProductComment(text)
}

function handleToggleLike(id) {
  store.toggleLike(id)
}
</script>

<template>
  <div class="product-comment">
    <!-- 工具栏 -->
    <div class="toolbar">
      <UserFilter :users="userList" @apply="handleFilter" />
      <span class="sort-btn" @click="toggleSort">⏱ {{ sortLabel }}▼</span>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list">
      <CommentItem
        v-for="c in filteredComments"
        :key="c.id"
        :comment="c"
        :currentUser="store.currentUser.name"
        @toggle-like="handleToggleLike"
      />
      <div v-if="filteredComments.length === 0" class="empty">暂无评论</div>
    </div>

    <!-- 底部输入 -->
    <CommentInput
      :userInitial="store.currentUser.initial"
      :userColor="store.currentUser.color"
      placeholder="输入评论..."
      @send="handleSend"
    />
  </div>
</template>

<style scoped>
.product-comment {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  border-bottom: 1px solid #f5f5f5;
  flex-shrink: 0;
}
.sort-btn {
  font-size: 12px;
  color: #666;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.sort-btn:hover {
  background: #f0f0f0;
}
.comment-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.empty {
  text-align: center;
  color: #ccc;
  padding: 40px 0;
  font-size: 13px;
}
</style>
```

---

### Task 6: 构建商品标签页面

**Files:**
- Create: `wxt/entrypoints/win/components/TagChip.vue`
- Create: `wxt/entrypoints/win/pages/product/tag.vue`

- [ ] **Step 1: 创建 TagChip.vue**

```vue
<template>
  <div class="tag-chip" :style="{ background: color }" @mouseenter="showActions = true" @mouseleave="showActions = false"
    @click.stop @contextmenu.prevent="showContextMenu = true">
    <span class="tag-text">{{ text }}</span>

    <!-- 悬停操作浮层 -->
    <div v-if="showActions && !showContextMenu" class="tag-actions">
      <button class="tag-action-btn" @click.stop="$emit('toggle-visible')">
        {{ visible ? '🔓 团队可见' : '🔒 仅自己' }}
      </button>
      <button class="tag-action-btn" @click.stop="$emit('remove')">🗑 移除</button>
    </div>

    <!-- 右键菜单（自己的标签） -->
    <Teleport to="body">
      <div v-if="showContextMenu" class="ctx-overlay" @click="showContextMenu = false" @contextmenu.prevent>
        <div class="ctx-menu" :style="{ left: ctxX + 'px', top: ctxY + 'px' }" @click.stop>
          <div class="ctx-item" @click.stop="startEdit">✏️ 修改</div>
          <div class="ctx-item ctx-danger" @click.stop="$emit('delete')">🗑 删除</div>
        </div>
      </div>
    </Teleport>

    <!-- 修改对话框 -->
    <Teleport to="body">
      <div v-if="editing" class="edit-overlay" @click="editing = false">
        <div class="edit-dialog" @click.stop>
          <div class="edit-title">修改标签</div>
          <input class="edit-input" v-model="editText" placeholder="标签名称" />
          <div class="edit-colors">
            <span v-for="c in colorOptions" :key="c" class="color-opt"
              :style="{ background: c }" :class="{ selected: editColor === c }"
              @click="editColor = c"></span>
          </div>
          <label class="edit-visible">
            <input type="checkbox" v-model="editVisible" /> 对团队可见
          </label>
          <div class="edit-actions">
            <button class="edit-cancel" @click="editing = false">取消</button>
            <button class="edit-save" @click="saveEdit">保存</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  color: { type: String, default: '#2ecc71' },
  visible: { type: Boolean, default: true },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-visible', 'remove', 'delete', 'update'])

const showActions = ref(false)
const showContextMenu = ref(false)
const editing = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
const editText = ref(props.text)
const editColor = ref(props.color)
const editVisible = ref(props.visible)

const colorOptions = ['#2ecc71', '#1677ff', '#9b59b6', '#ff6a00', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']

function startEdit(e) {
  showContextMenu.value = false
  editText.value = props.text
  editColor.value = props.color
  editVisible.value = props.visible
  editing.value = true
}

function saveEdit() {
  if (!editText.value.trim()) return
  emit('update', { text: editText.value.trim(), color: editColor.value, visible: editVisible.value })
  editing.value = false
}
</script>

<style scoped>
.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  color: #fff;
  cursor: pointer;
  position: relative;
  line-height: 20px;
}
.tag-text {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-actions {
  position: absolute;
  top: 100%;
  left: 0;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 10;
  display: flex;
  flex-direction: column;
  white-space: nowrap;
}
.tag-action-btn {
  border: none;
  background: none;
  padding: 6px 12px;
  font-size: 11px;
  cursor: pointer;
  color: #333;
  text-align: left;
}
.tag-action-btn:hover {
  background: #f5f5f5;
}
.ctx-overlay, .edit-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647;
}
.edit-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.2);
}
.ctx-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  z-index: 2147483648;
  overflow: hidden;
}
.ctx-item {
  padding: 8px 20px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
}
.ctx-item:hover {
  background: #f5f5f5;
}
.ctx-danger {
  color: #e74c3c;
}
.edit-dialog {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  width: 260px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.edit-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}
.edit-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  box-sizing: border-box;
  margin-bottom: 10px;
  outline: none;
}
.edit-input:focus {
  border-color: #1677ff;
}
.edit-colors {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.color-opt {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
}
.color-opt.selected {
  border-color: #333;
}
.edit-visible {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}
.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.edit-cancel, .edit-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  cursor: pointer;
}
.edit-cancel {
  background: #f5f5f5;
  color: #666;
}
.edit-save {
  background: #1677ff;
  color: #fff;
}
</style>
```

- [ ] **Step 2: 创建 product/tag.vue**

```vue
<script setup>
import { ref } from 'vue'
import { useApiStore } from '../../stores/api/api.js'
import TagChip from '../../components/TagChip.vue'

const store = useApiStore()

// ── 创建新标签 ──
const newTagText = ref('')
const newTagColor = ref('#2ecc71')
const newTagVisible = ref(true)

const colorOptions = ['#2ecc71', '#1677ff', '#9b59b6', '#ff6a00', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']

function createNewTag() {
  const text = newTagText.value.trim()
  if (!text) return
  const tag = store.createTag(text, newTagColor.value, newTagVisible.value)
  store.assignTagToProduct(tag.id)
  newTagText.value = ''
  newTagColor.value = '#2ecc71'
  newTagVisible.value = true
}

function handleUpdate(tagId, updates) {
  store.updateTag(tagId, updates)
}

function handleDelete(tagId) {
  store.deleteTag(tagId)
}
</script>

<template>
  <div class="product-tag">
    <!-- 已添加到本商品的标签 -->
    <div class="section">
      <div class="section-title">已添加到本商品的标签</div>
      <div v-if="store.productAssignedTags.length" class="tags-wrap">
        <TagChip
          v-for="tag in store.productAssignedTags"
          :key="tag.id"
          :text="tag.text"
          :color="tag.color"
          :visible="tag.visible"
          :editable="tag.added_by === store.currentUser.name"
          @toggle-visible="store.toggleTagVisibility(tag.id)"
          @remove="store.removeTagFromProduct(tag.id)"
          @delete="handleDelete(tag.id)"
          @update="(updates) => handleUpdate(tag.id, updates)"
        />
      </div>
      <div v-else class="empty">暂无标签</div>
    </div>

    <!-- 我的标签池 -->
    <div class="section">
      <div class="section-title">我的标签池</div>
      <div v-if="store.productAvailableTags.length" class="tags-wrap">
        <span v-for="tag in store.productAvailableTags" :key="tag.id"
          class="pool-tag"
          :style="{ background: tag.color }"
          @click="store.assignTagToProduct(tag.id)">
          {{ tag.text }}
        </span>
      </div>
      <div v-else class="empty">已全部添加</div>
    </div>

    <!-- 创建新标签 -->
    <div class="section create-section">
      <div class="section-title">创建新标签</div>
      <input class="create-input" v-model="newTagText" placeholder="输入标签名称..." @keydown.enter="createNewTag" />
      <div class="color-picker">
        <span v-for="c in colorOptions" :key="c" class="color-dot"
          :style="{ background: c, border: newTagColor === c ? '2px solid #333' : '2px solid transparent' }"
          @click="newTagColor = c"></span>
      </div>
      <label class="visible-toggle">
        <input type="checkbox" v-model="newTagVisible" /> 对团队可见
      </label>
      <button class="create-btn" @click="createNewTag" :disabled="!newTagText.trim()">创建新标签</button>
    </div>
  </div>
</template>

<style scoped>
.product-tag {
  padding: 8px 12px;
  overflow-y: auto;
  flex: 1;
}
.section {
  margin-bottom: 14px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #999;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
}
.tags-wrap, .color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.pool-tag {
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
  line-height: 20px;
}
.pool-tag:hover {
  opacity: 0.8;
}
.empty {
  font-size: 12px;
  color: #ccc;
  padding: 8px 0;
  text-align: center;
}
.create-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 10px;
}
.create-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 12px;
  box-sizing: border-box;
  margin-bottom: 8px;
  outline: none;
}
.create-input:focus {
  border-color: #1677ff;
}
.color-picker {
  margin-bottom: 6px;
}
.color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  box-sizing: border-box;
}
.visible-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}
.create-btn {
  width: 100%;
  border: none;
  background: #1677ff;
  color: #fff;
  padding: 7px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.create-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
```

---

### Task 7: 构建供应商评论页面

**Files:**
- Create: `wxt/entrypoints/win/pages/supplier/comment.vue`

- [ ] **Step 1: 创建 supplier/comment.vue**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useApiStore } from '../../stores/api/api.js'
import CommentItem from '../../components/CommentItem.vue'
import CommentInput from '../../components/CommentInput.vue'
import UserFilter from '../../components/UserFilter.vue'

const store = useApiStore()

const sortOrder = ref('newest')
const filterUsers = ref([])

function toggleSort() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}

const sortLabel = computed(() => sortOrder.value === 'newest' ? '最新' : '最早')

const filteredComments = computed(() => {
  let list = [...store.supplierComments]
  if (filterUsers.value.length > 0) {
    list = list.filter(c => filterUsers.value.includes(c.user_name))
  }
  if (sortOrder.value === 'newest') {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  } else {
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }
  return list
})

const userList = computed(() => {
  const map = {}
  store.supplierComments.forEach(c => {
    map[c.user_name] = (map[c.user_name] || 0) + 1
  })
  return Object.entries(map).map(([name, count]) => ({ name, count }))
})

function handleFilter(selected) {
  filterUsers.value = selected
}

function handleSend(text) {
  store.addSupplierComment(text)
}

function handleToggleLike(id) {
  store.toggleSupplierLike(id)
}
</script>

<template>
  <div class="supplier-comment">
    <!-- 合作状态 -->
    <div class="coop-section">
      <label class="coop-check">
        <input type="checkbox" :checked="store.supplierCooperated" @change="store.toggleCooperation()" />
        <span class="coop-label" :class="{ coop: store.supplierCooperated }">
          {{ store.supplierCooperated ? '✅ 已合作' : '标记为已合作' }}
        </span>
      </label>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <UserFilter :users="userList" @apply="handleFilter" />
      <span class="sort-btn" @click="toggleSort">⏱ {{ sortLabel }}▼</span>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list">
      <CommentItem
        v-for="c in filteredComments"
        :key="c.id"
        :comment="c"
        :currentUser="store.currentUser.name"
        @toggle-like="handleToggleLike"
      />
      <div v-if="filteredComments.length === 0" class="empty">暂无评论</div>
    </div>

    <!-- 底部输入 -->
    <CommentInput
      :userInitial="store.currentUser.initial"
      :userColor="store.currentUser.color"
      placeholder="输入评论..."
      @send="handleSend"
    />
  </div>
</template>

<style scoped>
.supplier-comment {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── 合作状态 ── */
.coop-section {
  padding: 6px 12px;
  border-bottom: 1px solid #f5f5f5;
}
.coop-check {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.coop-label {
  font-size: 12px;
  color: #999;
}
.coop-label.coop {
  color: #52c41a;
  font-weight: 600;
}

/* ── 工具栏 ── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  border-bottom: 1px solid #f5f5f5;
  flex-shrink: 0;
}
.sort-btn {
  font-size: 12px;
  color: #666;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.sort-btn:hover {
  background: #f0f0f0;
}
.comment-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.empty {
  text-align: center;
  color: #ccc;
  padding: 40px 0;
  font-size: 13px;
}
</style>
```

---

### Task 8: 构建供应商标签页面

**Files:**
- Create: `wxt/entrypoints/win/pages/supplier/tag.vue`

- [ ] **Step 1: 创建 supplier/tag.vue**

与 product/tag.vue 结构一致，只改数据来源（store.supplierAssignedTags / store.supplierAvailableTags）：

```vue
<script setup>
import { ref } from 'vue'
import { useApiStore } from '../../stores/api/api.js'
import TagChip from '../../components/TagChip.vue'

const store = useApiStore()

const newTagText = ref('')
const newTagColor = ref('#2ecc71')
const newTagVisible = ref(true)

const colorOptions = ['#2ecc71', '#1677ff', '#9b59b6', '#ff6a00', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']

function createNewTag() {
  const text = newTagText.value.trim()
  if (!text) return
  const tag = store.createTag(text, newTagColor.value, newTagVisible.value)
  store.assignTagToSupplier(tag.id)
  newTagText.value = ''
  newTagColor.value = '#2ecc71'
  newTagVisible.value = true
}

function handleUpdate(tagId, updates) {
  store.updateTag(tagId, updates)
}

function handleDelete(tagId) {
  store.deleteTag(tagId)
}
</script>

<template>
  <div class="supplier-tag">
    <!-- 已添加标签 -->
    <div class="section">
      <div class="section-title">已添加到本供应商的标签</div>
      <div v-if="store.supplierAssignedTags.length" class="tags-wrap">
        <TagChip
          v-for="tag in store.supplierAssignedTags"
          :key="tag.id"
          :text="tag.text"
          :color="tag.color"
          :visible="tag.visible"
          :editable="tag.added_by === store.currentUser.name"
          @toggle-visible="store.toggleSupplierTagVisibility(tag.id)"
          @remove="store.removeTagFromSupplier(tag.id)"
          @delete="handleDelete(tag.id)"
          @update="(updates) => handleUpdate(tag.id, updates)"
        />
      </div>
      <div v-else class="empty">暂无标签</div>
    </div>

    <!-- 我的标签池 -->
    <div class="section">
      <div class="section-title">我的标签池</div>
      <div v-if="store.supplierAvailableTags.length" class="tags-wrap">
        <span v-for="tag in store.supplierAvailableTags" :key="tag.id"
          class="pool-tag"
          :style="{ background: tag.color }"
          @click="store.assignTagToSupplier(tag.id)">
          {{ tag.text }}
        </span>
      </div>
      <div v-else class="empty">已全部添加</div>
    </div>

    <!-- 创建新标签 -->
    <div class="section create-section">
      <div class="section-title">创建新标签</div>
      <input class="create-input" v-model="newTagText" placeholder="输入标签名称..." @keydown.enter="createNewTag" />
      <div class="color-picker">
        <span v-for="c in colorOptions" :key="c" class="color-dot"
          :style="{ background: c, border: newTagColor === c ? '2px solid #333' : '2px solid transparent' }"
          @click="newTagColor = c"></span>
      </div>
      <label class="visible-toggle">
        <input type="checkbox" v-model="newTagVisible" /> 对团队可见
      </label>
      <button class="create-btn" @click="createNewTag" :disabled="!newTagText.trim()">创建新标签</button>
    </div>
  </div>
</template>

<style scoped>
.supplier-tag {
  padding: 8px 12px;
  overflow-y: auto;
  flex: 1;
}
.section {
  margin-bottom: 14px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #999;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
}
.tags-wrap, .color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.pool-tag {
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
  line-height: 20px;
}
.pool-tag:hover {
  opacity: 0.8;
}
.empty {
  font-size: 12px;
  color: #ccc;
  padding: 8px 0;
  text-align: center;
}
.create-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 10px;
}
.create-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 12px;
  box-sizing: border-box;
  margin-bottom: 8px;
  outline: none;
}
.create-input:focus {
  border-color: #1677ff;
}
.color-picker {
  margin-bottom: 6px;
}
.color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  box-sizing: border-box;
}
.visible-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}
.create-btn {
  width: 100%;
  border: none;
  background: #1677ff;
  color: #fff;
  padding: 7px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.create-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
```

---

### Task 9: 构建分析 > 用户浏览量页面（ECharts 环形图）

**Files:**
- Create: `wxt/entrypoints/win/pages/analysis/views.vue`

- [ ] **Step 1: 创建 analysis/views.vue**

```vue
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import { useApiStore } from '../../stores/api/api.js'

const store = useApiStore()
const chartRef = ref(null)
let chartInstance = null

const chartData = computed(() => {
  return store.viewerStatsWithPercent.map(v => ({
    name: v.name,
    value: v.count,
    percent: v.percentage,
  }))
})

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

function updateChart() {
  if (!chartInstance) return
  const data = chartData.value
  chartInstance.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}次 ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11,
          color: '#666',
        },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold' },
        },
        data: data.map(v => ({
          name: v.name,
          value: v.value,
        })),
      },
    ],
  })
}

const totalViewCount = computed(() =>
  store.viewerStats.reduce((s, v) => s + v.count, 0)
)

onMounted(initChart)
onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<template>
  <div class="analysis-views">
    <div ref="chartRef" class="chart-container"></div>
    <div class="stats-summary">
      <span>总浏览次数: {{ totalViewCount }}</span>
      <span>总浏览人数: {{ store.viewerStats.length }}</span>
    </div>
    <div class="viewer-list">
      <div v-for="v in store.viewerStats" :key="v.name" class="viewer-row">
        <span class="viewer-rank">🥇</span>
        <span class="viewer-name">{{ v.name }}</span>
        <span class="viewer-count">{{ v.count }}次</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-views {
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.chart-container {
  width: 240px;
  height: 240px;
}
.stats-summary {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
  margin: 8px 0;
}
.viewer-list {
  width: 100%;
}
.viewer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
}
.viewer-row + .viewer-row {
  border-top: 1px solid #f5f5f5;
}
.viewer-rank {
  font-size: 14px;
}
.viewer-name {
  flex: 1;
  color: #333;
  font-weight: 500;
}
.viewer-count {
  color: #999;
}
</style>
```

---

### Task 10: 构建分析 > 浏览记录页面

**Files:**
- Create: `wxt/entrypoints/win/pages/analysis/records.vue`

- [ ] **Step 1: 创建 analysis/records.vue**

```vue
<script setup>
import { useApiStore } from '../../stores/api/api.js'
const store = useApiStore()
</script>

<template>
  <div class="analysis-records">
    <div v-for="(r, i) in store.viewRecords" :key="i" class="record-item">
      <div class="record-avatar" :style="{ background: r.color }">{{ r.initial }}</div>
      <div class="record-body">
        <span class="record-name">{{ r.user_name }}</span>
        <span class="record-time">{{ r.time }}</span>
      </div>
    </div>
    <div v-if="store.viewRecords.length === 0" class="empty">暂无浏览记录</div>
  </div>
</template>

<style scoped>
.analysis-records {
  padding: 4px 0;
}
.record-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}
.record-item + .record-item {
  border-top: 1px solid #f5f5f5;
}
.record-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}
.record-body {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.record-name {
  font-size: 13px;
  color: #333;
  font-weight: 500;
}
.record-time {
  font-size: 11px;
  color: #bbb;
}
.empty {
  text-align: center;
  color: #ccc;
  padding: 40px 0;
  font-size: 13px;
}
</style>
```

---

### Task 11: 清理旧文件

**Files:**
- Delete: `wxt/entrypoints/win/pages/home/` (整个目录)
- Delete: `wxt/entrypoints/win/pages/offer/` (整个目录)
- Delete: `wxt/entrypoints/win/pages/factory/` (整个目录)
- Delete: `wxt/entrypoints/win/components/SubNav.vue`
- Delete: `wxt/entrypoints/win/components/tab.vue`

- [ ] **Step 1: 删除旧页面目录和组件**

```bash
rm -rf wxt/entrypoints/win/pages/home
rm -rf wxt/entrypoints/win/pages/offer
rm -rf wxt/entrypoints/win/pages/factory
rm wxt/entrypoints/win/components/SubNav.vue
rm wxt/entrypoints/win/components/tab.vue
```

- [ ] **Step 2: 验证构建**

```bash
npm run build
```

确认无报错。

---

### Task 12: 手动验证（浏览器）

- [ ] **Step 1: 启动 dev server**（WXT 方式待确认，可能是 `npm run dev`）

- [ ] **Step 2: 打开 1688 产品详情页，检查：**
  - 标题栏显示 "1688 协作"
  - 产品概览区：缩略图 + 标题/供应商 + 浏览次数 + 头像栈
  - Tab 切换正常：商品/供应商/分析
  - SubTab 切换正常

- [ ] **Step 3: 验证评论功能：**
  - 评论列表显示正确
  - 点赞 toggle 正常工作
  - 搜索用户筛选正常
  - 排序切换正常
  - 新增评论发送正常

- [ ] **Step 4: 验证标签功能：**
  - 已添加标签显示正确
  - 悬停显示操作浮层
  - 右键显示修改/删除菜单
  - 从我的标签池点击添加
  - 创建新标签

- [ ] **Step 5: 验证分析页：**
  - 环形图渲染正确
  - 浏览记录列表显示正常

- [ ] **Step 6: 验证供应商页：**
  - 合作状态勾选
  - 供应商评论/标签功能