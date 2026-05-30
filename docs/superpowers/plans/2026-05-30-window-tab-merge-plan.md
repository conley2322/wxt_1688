# 悬浮窗口 Tab 合并实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将商品和供应商的评论/标签子 Tab 合并为各自的单页面，标签以云的形式与评论共存，消除重复 UI。

**Architecture:** 3 个新组件（TagCloud 标签云 / TagPool 标签池 / TagCreator 标签创建器）+ 更新 store 数据模型（tag 新增 font_color/bg_color/visibility/like_count/creator/created_at）+ 合并页面去除子 Tab + 简化路由。

**Tech Stack:** Vue 3 + Vue Router 4 + Pinia + WXT

---

## 文件结构

### 新建文件 (3个)
| 文件 | 职责 |
|------|------|
| `wxt/entrypoints/win/components/TagCloud.vue` | 标签云：已分配标签展示、排序、点赞、tooltip |
| `wxt/entrypoints/win/components/TagPool.vue` | 标签池：未添加/已添加标签分区展示、点击添加/取消 |
| `wxt/entrypoints/win/components/TagCreator.vue` | 标签创建器：输入标签名 + 字体色/背景色/可见性配置 |

### 修改文件 (4个)
| 文件 | 修改内容 |
|------|---------|
| `wxt/stores/api/api.js` | tag 数据模型扩展：新增 font_color、bg_color、visibility、like_count、creator、created_at |
| `wxt/entrypoints/win/pages/product/comment.vue` | 合并标签云 + 输入区支持评论/标签模式切换 |
| `wxt/entrypoints/win/pages/supplier/comment.vue` | 合并标签云 + 合作状态 + 输入区支持评论/标签模式切换 |
| `wxt/entrypoints/win/router.js` | 移除 /product/tag、/supplier/tag 路由，/product/comment→/product |
| `wxt/entrypoints/win/App.vue` | 移除子 Tab 栏，主 Tab 路由更新 |

### 删除文件 (2个)
| 文件 | 原因 |
|------|------|
| `wxt/entrypoints/win/pages/product/tag.vue` | 功能合并到 product/comment.vue |
| `wxt/entrypoints/win/pages/supplier/tag.vue` | 功能合并到 supplier/comment.vue |

---

## 前置依赖

以下组件已存在且无需改动，直接复用：
- `CommentItem.vue` — 单条评论卡片
- `CommentInput.vue` — 底部输入框
- `UserFilter.vue` — 用户筛选器
- `TagChip.vue` — 标签芯片（悬停操作浮层）

---

### Task 1: 更新 api store 标签数据模型

**Files:**
- Modify: `wxt/stores/api/api.js`

**当前状态：** store 只有 `ajax()` 函数，tag/comment 数据完全缺失。

**目标：** 添加 tag/comment 全部状态和方法，tag 数据模型使用新字段。

- [ ] **Step 1: 添加 currentUser、tag 相关状态**

在 `defineStore` 的回调函数中，`ajax` 函数之前添加以下代码：

```javascript
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

// ── 商品可用标签（标签池中未分配的） ──
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
```

- [ ] **Step 2: 添加 tag 操作方法**

在 Step 1 代码之后继续添加：

```javascript
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
```

- [ ] **Step 3: 添加评论相关状态和方法**

在 Step 2 之后继续添加：

```javascript
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
```

- [ ] **Step 4: 更新 return 语句**

将现有的 `return { ajax }` 替换为完整的导出：

```javascript
  return {
    // 数据请求
    ajax,
    // 用户
    currentUser,
    // 标签
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
    // 评论
    productComments,
    supplierComments,
    addProductComment,
    toggleLike,
    addSupplierComment,
    toggleSupplierLike,
    // 合作状态
    supplierCooperated,
    toggleCooperation,
  }
```

- [ ] **Step 5: 验证 store 完整性**

打开浏览器控制台，确认无 import 错误。在后续 Task 中页面会逐步消费这些数据。

- [ ] **Step 6: 提交**

```bash
git add wxt/stores/api/api.js
git commit -m "feat(store): 扩展标签数据模型，新增 font_color/bg_color/visibility/like_count"
```

---

### Task 2: 创建 TagCloud 标签云组件

**Files:**
- Create: `wxt/entrypoints/win/components/TagCloud.vue`

**职责：** 顶部展示所有已分配标签，按"我的标签在前、他人标签按点赞数降序"排列，支持点赞/取消点赞，鼠标悬停显示 tooltip。

- [ ] **Step 1: 创建 TagCloud.vue**

```vue
<template>
  <div class="tag-cloud">
    <span class="cloud-label">🏷 标签云</span>
    <div class="cloud-tags">
      <span
        v-for="tag in sortedTags"
        :key="tag.id"
        class="cloud-tag"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="handleClick(tag)"
        @mouseenter="hoveredTag = tag"
        @mouseleave="hoveredTag = null"
      >
        {{ tag.text }}
        <span class="tag-count" v-if="tag.like_count > 0">×{{ tag.like_count }}</span>
        <span v-if="tag.visibility === 'private'" class="tag-lock">🔒</span>

        <!-- Tooltip -->
        <div v-if="hoveredTag === tag" class="tag-tooltip">
          <div>标签：{{ tag.text }}</div>
          <div>创建者：{{ tag.creator }}</div>
          <div>创建时间：{{ formatDate(tag.created_at) }}</div>
          <div>认同人数：{{ tag.like_count }}人</div>
        </div>
      </span>
      <span v-if="sortedTags.length === 0" class="cloud-empty">暂无标签</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  tags: { type: Array, required: true },         // assignedTags
  currentUser: { type: String, required: true },
})

const emit = defineEmits(['like', 'unlike', 'remove'])

const hoveredTag = ref(null)

const sortedTags = computed(() => {
  const my = []
  const others = []
  for (const tag of props.tags) {
    // 私有标签只对创建者显示
    if (tag.visibility === 'private' && tag.creator !== props.currentUser) continue
    if (tag.creator === props.currentUser) {
      my.push(tag)
    } else {
      others.push(tag)
    }
  }
  my.sort((a, b) => b.like_count - a.like_count)
  others.sort((a, b) => b.like_count - a.like_count)
  return [...my, ...others]
})

function handleClick(tag) {
  // 我创建的标签 → 删除
  if (tag.creator === props.currentUser) {
    emit('remove', tag.id)
  } else {
    // 别人的标签 → 点赞/取消点赞
    // 简化处理：每次点击都 +1
    emit('like', tag.id)
  }
}

function formatDate(iso) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
</script>

<style scoped>
.tag-cloud {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}
.cloud-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
  display: block;
}
.cloud-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cloud-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  position: relative;
  transition: opacity 0.15s;
  line-height: 18px;
}
.cloud-tag:hover {
  opacity: 0.8;
}
.tag-count {
  font-size: 10px;
  opacity: 0.8;
}
.tag-lock {
  font-size: 10px;
}
.tag-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10;
  line-height: 1.6;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.cloud-empty {
  font-size: 12px;
  color: #ccc;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add wxt/entrypoints/win/components/TagCloud.vue
git commit -m "feat: 新增 TagCloud 标签云组件"
```

---

### Task 3: 创建 TagPool 标签池组件

**Files:**
- Create: `wxt/entrypoints/win/components/TagPool.vue`

**职责：** 在输入区切换到标签模式后显示，分两个区域：未添加的标签（可点击添加）和已添加的标签（可点击取消）。

- [ ] **Step 1: 创建 TagPool.vue**

```vue
<template>
  <div class="tag-pool">
    <div v-if="availableTags.length" class="pool-section">
      <span class="pool-label">可添加：</span>
      <span
        v-for="tag in availableTags"
        :key="tag.id"
        class="pool-tag"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="$emit('assign', tag.id)"
      >
        {{ tag.text }}
      </span>
    </div>
    <div v-if="assignedTags.length" class="pool-section">
      <span class="pool-label">已添加（点击取消）：</span>
      <span
        v-for="tag in assignedTags"
        :key="tag.id"
        class="pool-tag assigned"
        :style="{ background: tag.bg_color, color: tag.font_color }"
        @click="$emit('remove', tag.id)"
      >
        {{ tag.text }} ×{{ tag.like_count }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  availableTags: { type: Array, required: true },
  assignedTags: { type: Array, required: true },
})
defineEmits(['assign', 'remove'])
</script>

<style scoped>
.tag-pool {
  padding: 6px 12px;
  border-top: 1px solid #f0f0f0;
}
.pool-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.pool-section:last-child {
  margin-bottom: 0;
}
.pool-label {
  font-size: 11px;
  color: #999;
  width: 100%;
  margin-bottom: 2px;
}
.pool-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  transition: opacity 0.15s;
  line-height: 18px;
}
.pool-tag:hover {
  opacity: 0.8;
}
.pool-tag.assigned {
  opacity: 0.7;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add wxt/entrypoints/win/components/TagPool.vue
git commit -m "feat: 新增 TagPool 标签池组件"
```

---

### Task 4: 创建 TagCreator 标签创建器组件

**Files:**
- Create: `wxt/entrypoints/win/components/TagCreator.vue`

**职责：** 输入新标签名后展开字体色/背景色/可见性配置，点击创建。

- [ ] **Step 1: 创建 TagCreator.vue**

```vue
<template>
  <div class="tag-creator">
    <div class="creator-input-row">
      <input
        class="creator-input"
        v-model="tagText"
        placeholder="输入新标签名..."
        @keydown.enter="handleCreate"
        @focus="expanded = true"
      />
      <button class="creator-btn" :disabled="!tagText.trim()" @click="handleCreate">添加</button>
    </div>

    <div v-if="expanded" class="creator-options">
      <div class="option-row">
        <span class="option-label">字体色：</span>
        <span
          v-for="c in fontColors"
          :key="c"
          class="color-dot"
          :style="{ background: c, border: fontColor === c ? '2px solid #333' : '2px solid transparent' }"
          @click="fontColor = c"
        />
      </div>
      <div class="option-row">
        <span class="option-label">背景色：</span>
        <span
          v-for="c in bgColors"
          :key="c"
          class="color-dot"
          :style="{ background: c, border: bgColor === c ? '2px solid #333' : '2px solid transparent' }"
          @click="bgColor = c"
        />
      </div>
      <div class="option-row">
        <span class="option-label">可见性：</span>
        <label class="radio-label">
          <input type="radio" value="public" v-model="visibility" /> 公开
        </label>
        <label class="radio-label">
          <input type="radio" value="private" v-model="visibility" /> 仅自己可见
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['create'])

const tagText = ref('')
const fontColor = ref('#fff')
const bgColor = ref('#2ecc71')
const visibility = ref('public')
const expanded = ref(false)

const fontColors = ['#fff', '#000', '#e74c3c', '#1677ff', '#2ecc71']
const bgColors = ['#2ecc71', '#1677ff', '#9b59b6', '#ff6a00', '#e74c3c', '#34495e']

function handleCreate() {
  const text = tagText.value.trim()
  if (!text) return
  emit('create', {
    text,
    fontColor: fontColor.value,
    bgColor: bgColor.value,
    visibility: visibility.value,
  })
  tagText.value = ''
  fontColor.value = '#fff'
  bgColor.value = '#2ecc71'
  visibility.value = 'public'
}
</script>

<style scoped>
.tag-creator {
  padding: 6px 12px;
  border-top: 1px solid #f0f0f0;
}
.creator-input-row {
  display: flex;
  gap: 6px;
}
.creator-input {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
}
.creator-input:focus {
  border-color: #1677ff;
}
.creator-btn {
  border: none;
  background: #1677ff;
  color: #fff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.creator-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.creator-options {
  margin-top: 8px;
  padding: 8px;
  background: #fafafa;
  border-radius: 6px;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.option-row:last-child {
  margin-bottom: 0;
}
.option-label {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}
.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  box-sizing: border-box;
}
.radio-label {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 3px;
  margin-right: 8px;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add wxt/entrypoints/win/components/TagCreator.vue
git commit -m "feat: 新增 TagCreator 标签创建器组件"
```

---

### Task 5: 重写商品页面 product/comment.vue

**Files:**
- Modify: `wxt/entrypoints/win/pages/product/comment.vue`

**目标：** 合并标签云 + 评论列表 + 输入区（支持评论/标签模式切换），替代原来的纯评论页面。

- [ ] **Step 1: 重写 product/comment.vue**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useApiStore } from '@/stores/api/api.js'
import TagCloud from '@/entrypoints/win/components/TagCloud.vue'
import TagPool from '@/entrypoints/win/components/TagPool.vue'
import TagCreator from '@/entrypoints/win/components/TagCreator.vue'
import CommentItem from '@/entrypoints/win/components/CommentItem.vue'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import UserFilter from '@/entrypoints/win/components/UserFilter.vue'

const store = useApiStore()

// ── 输入模式：'comment' | 'tag' ──
const inputMode = ref('comment')

// ── 评论排序/筛选 ──
const sortOrder = ref('newest')
const filterUsers = ref([])

function toggleSort() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}

const sortLabel = computed(() => sortOrder.value === 'newest' ? '最新' : '最早')

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

const userList = computed(() => {
  const map = {}
  store.productComments.forEach(c => {
    map[c.user_name] = (map[c.user_name] || 0) + 1
  })
  return Object.entries(map).map(([name, count]) => ({ name, count }))
})

// ── 评论操作 ──
function handleSendComment(text) {
  store.addProductComment(text)
}

function handleToggleLike(id) {
  store.toggleLike(id)
}

// ── 标签操作 ──
function handleTagLike(tagId) {
  store.likeProductTag(tagId)
}

function handleTagRemove(tagId) {
  store.removeTagFromProduct(tagId)
}

function handleTagAssign(tagId) {
  store.assignTagToProduct(tagId)
}

function handleTagCreate({ text, fontColor, bgColor, visibility }) {
  const tag = store.createTag(text, fontColor, bgColor, visibility)
  store.assignTagToProduct(tag.id)
}

// ── 输入框配置 ──
const inputPlaceholder = computed(() =>
  inputMode.value === 'comment' ? '输入评论...' : '输入标签名...'
)
const inputSendLabel = computed(() =>
  inputMode.value === 'comment' ? '评论' : '添加'
)

function handleInputSend(text) {
  if (inputMode.value === 'comment') {
    handleSendComment(text)
  } else {
    handleTagCreate({ text, fontColor: '#fff', bgColor: '#2ecc71', visibility: 'public' })
  }
}
</script>

<template>
  <div class="product-page">
    <!-- 标签云 -->
    <TagCloud
      :tags="store.productAssignedTags"
      :currentUser="store.currentUser.name"
      @like="handleTagLike"
      @remove="handleTagRemove"
    />

    <!-- 评论工具栏 -->
    <div class="toolbar">
      <UserFilter :users="userList" @apply="(u) => filterUsers = u" />
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

    <!-- 标签模式：标签池 + 创建器 -->
    <template v-if="inputMode === 'tag'">
      <TagPool
        :availableTags="store.productAvailableTags"
        :assignedTags="store.productAssignedTags"
        @assign="handleTagAssign"
        @remove="handleTagRemove"
      />
      <TagCreator @create="handleTagCreate" />
    </template>

    <!-- 输入区 -->
    <div class="input-area">
      <CommentInput
        :userInitial="store.currentUser.initial"
        :userColor="store.currentUser.color"
        :placeholder="inputPlaceholder"
        :sendLabel="inputSendLabel"
        @send="handleInputSend"
      />
      <div class="mode-switch">
        <span
          class="mode-btn"
          :class="{ active: inputMode === 'comment' }"
          @click="inputMode = 'comment'"
        >评论 ▾</span>
        <span
          class="mode-btn"
          :class="{ active: inputMode === 'tag' }"
          @click="inputMode = 'tag'"
        >标签 ▾</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-page {
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
.input-area {
  flex-shrink: 0;
  border-top: 1px solid #f0f0f0;
}
.mode-switch {
  display: flex;
  gap: 12px;
  padding: 0 12px 6px;
}
.mode-btn {
  font-size: 11px;
  color: #999;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.mode-btn.active {
  color: #1677ff;
  font-weight: 500;
}
.mode-btn:hover {
  background: #f5f5f5;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add wxt/entrypoints/win/pages/product/comment.vue
git commit -m "feat: 商品页面合并标签云，支持评论/标签模式切换"
```

---

### Task 6: 重写供应商页面 supplier/comment.vue

**Files:**
- Modify: `wxt/entrypoints/win/pages/supplier/comment.vue`

**目标：** 与商品页面基本一致，额外包含「已合作」勾选。

- [ ] **Step 1: 重写 supplier/comment.vue**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useApiStore } from '@/stores/api/api.js'
import TagCloud from '@/entrypoints/win/components/TagCloud.vue'
import TagPool from '@/entrypoints/win/components/TagPool.vue'
import TagCreator from '@/entrypoints/win/components/TagCreator.vue'
import CommentItem from '@/entrypoints/win/components/CommentItem.vue'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import UserFilter from '@/entrypoints/win/components/UserFilter.vue'

const store = useApiStore()

const inputMode = ref('comment')
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

function handleSendComment(text) {
  store.addSupplierComment(text)
}

function handleToggleLike(id) {
  store.toggleSupplierLike(id)
}

function handleTagLike(tagId) {
  store.likeSupplierTag(tagId)
}

function handleTagRemove(tagId) {
  store.removeTagFromSupplier(tagId)
}

function handleTagAssign(tagId) {
  store.assignTagToSupplier(tagId)
}

function handleTagCreate({ text, fontColor, bgColor, visibility }) {
  const tag = store.createTag(text, fontColor, bgColor, visibility)
  store.assignTagToSupplier(tag.id)
}

const inputPlaceholder = computed(() =>
  inputMode.value === 'comment' ? '输入评论...' : '输入标签名...'
)
const inputSendLabel = computed(() =>
  inputMode.value === 'comment' ? '评论' : '添加'
)

function handleInputSend(text) {
  if (inputMode.value === 'comment') {
    handleSendComment(text)
  } else {
    handleTagCreate({ text, fontColor: '#fff', bgColor: '#2ecc71', visibility: 'public' })
  }
}
</script>

<template>
  <div class="supplier-page">
    <!-- 标签云 + 合作状态 -->
    <div class="tag-cloud-row">
      <TagCloud
        class="flex-1"
        :tags="store.supplierAssignedTags"
        :currentUser="store.currentUser.name"
        @like="handleTagLike"
        @remove="handleTagRemove"
      />
      <label class="coop-check">
        <input type="checkbox" :checked="store.supplierCooperated" @change="store.toggleCooperation()" />
        <span class="coop-label" :class="{ coop: store.supplierCooperated }">
          {{ store.supplierCooperated ? '✅ 已合作' : '标记为已合作' }}
        </span>
      </label>
    </div>

    <!-- 评论工具栏 -->
    <div class="toolbar">
      <UserFilter :users="userList" @apply="(u) => filterUsers = u" />
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

    <!-- 标签模式 -->
    <template v-if="inputMode === 'tag'">
      <TagPool
        :availableTags="store.supplierAvailableTags"
        :assignedTags="store.supplierAssignedTags"
        @assign="handleTagAssign"
        @remove="handleTagRemove"
      />
      <TagCreator @create="handleTagCreate" />
    </template>

    <!-- 输入区 -->
    <div class="input-area">
      <CommentInput
        :userInitial="store.currentUser.initial"
        :userColor="store.currentUser.color"
        :placeholder="inputPlaceholder"
        :sendLabel="inputSendLabel"
        @send="handleInputSend"
      />
      <div class="mode-switch">
        <span class="mode-btn" :class="{ active: inputMode === 'comment' }" @click="inputMode = 'comment'">评论 ▾</span>
        <span class="mode-btn" :class="{ active: inputMode === 'tag' }" @click="inputMode = 'tag'">标签 ▾</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.supplier-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.tag-cloud-row {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
}
.flex-1 {
  flex: 1;
  min-width: 0;
}
.coop-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 10px 12px 0 0;
  flex-shrink: 0;
}
.coop-label {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}
.coop-label.coop {
  color: #52c41a;
  font-weight: 600;
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
.input-area {
  flex-shrink: 0;
  border-top: 1px solid #f0f0f0;
}
.mode-switch {
  display: flex;
  gap: 12px;
  padding: 0 12px 6px;
}
.mode-btn {
  font-size: 11px;
  color: #999;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.mode-btn.active {
  color: #1677ff;
  font-weight: 500;
}
.mode-btn:hover {
  background: #f5f5f5;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add wxt/entrypoints/win/pages/supplier/comment.vue
git commit -m "feat: 供应商页面合并标签云+合作状态，支持评论/标签模式切换"
```

---

### Task 7: 更新 CommentInput 支持 sendLabel prop

**Files:**
- Modify: `wxt/entrypoints/win/components/CommentInput.vue`

**当前问题：** 按钮文字硬编码为"发送"，需要支持自定义（评论/添加）。

- [ ] **Step 1: 添加 sendLabel prop**

在 `defineProps` 中添加：

```javascript
const props = defineProps({
  userInitial: { type: String, default: 'C' },
  userColor: { type: String, default: '#ff6a00' },
  placeholder: { type: String, default: '输入评论...' },
  sendLabel: { type: String, default: '发送' },  // 新增
})
```

- [ ] **Step 2: 模板中使用 sendLabel**

将 `<button>` 内的 `发送` 替换为 `{{ sendLabel }}`：

```html
<button class="send-btn" :disabled="!text.trim()" @click="submit">{{ sendLabel }}</button>
```

- [ ] **Step 3: 提交**

```bash
git add wxt/entrypoints/win/components/CommentInput.vue
git commit -m "feat: CommentInput 支持 sendLabel prop"
```

---

### Task 8: 更新路由

**Files:**
- Modify: `wxt/entrypoints/win/router.js`

- [ ] **Step 1: 重写路由**

```javascript
import { createRouter, createMemoryHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/product' },
  {
    path: '/product',
    name: 'product',
    component: () => import('./pages/product/comment.vue'),
  },
  {
    path: '/supplier',
    name: 'supplier',
    component: () => import('./pages/supplier/comment.vue'),
  },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router
```

- [ ] **Step 2: 提交**

```bash
git add wxt/entrypoints/win/router.js
git commit -m "feat: 简化路由，移除子 Tab 路由"
```

---

### Task 9: 更新 App.vue 移除子 Tab

**Files:**
- Modify: `wxt/entrypoints/win/App.vue`

**当前 App.vue 的 subTabs 计算属性和 sub-tabs 栏需要移除。**

- [ ] **Step 1: 移除 subTabs 相关代码**

删除以下代码块：
1. `const subTabs = computed(...)` 函数（41-61行）
2. `function isSubTabActive(path)` 函数（82-84行）
3. 模板中的 `<div class="sub-tabs">` 区块（112-118行）

- [ ] **Step 2: 更新主 Tab 导航路径**

将 `goToTab` 函数更新为：

```javascript
function goToTab(tab) {
  switch (tab) {
    case 'product': router.push('/product'); break
    case 'supplier': router.push('/supplier'); break
    case 'analysis': router.push('/analysis/views'); break
  }
}
```

将 `currentTab` 初始值的判断更新（检测当前路由是否以 `/product` 或 `/supplier` 开头）：

```javascript
const currentTab = computed(() => {
  if (route.path.startsWith('/product')) return 'product'
  if (route.path.startsWith('/supplier')) return 'supplier'
  if (route.path.startsWith('/analysis')) return 'analysis'
  return 'product'
})
```

注意：`currentTab` 从 `ref` 改为 `computed`，因为 Tab 状态应该由路由决定而不是独立维护。

- [ ] **Step 3: 删除 sub-tabs 相关样式**

删除 `.sub-tabs` 和 `.sub-tab` 样式块。

- [ ] **Step 4: 提交**

```bash
git add wxt/entrypoints/win/App.vue
git commit -m "feat: App.vue 移除子 Tab 栏，简化主 Tab 导航"
```

---

### Task 10: 删除旧标签页面

**Files:**
- Delete: `wxt/entrypoints/win/pages/product/tag.vue`
- Delete: `wxt/entrypoints/win/pages/supplier/tag.vue`

- [ ] **Step 1: 删除文件**

```bash
rm wxt/entrypoints/win/pages/product/tag.vue
rm wxt/entrypoints/win/pages/supplier/tag.vue
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "chore: 删除已合并的标签页面"
```

---

### Task 11: 端到端验证

- [ ] **Step 1: 启动开发模式**

```bash
cd wxt && npm run dev
```

- [ ] **Step 2: 逐项检查**

在 1688 商品详情页打开悬浮窗口，验证：

1. 商品 Tab 打开后直接显示标签云 + 评论列表，无子 Tab
2. 标签云正确显示标签，排序规则正确（我的标签在前）
3. 鼠标悬停标签显示 tooltip（创建者、创建时间、认同人数）
4. 点击我创建的标签 → 标签被删除
5. 点击别人的标签 → like_count +1
6. 评论列表排序/筛选正常
7. 发评论正常
8. 切换到标签模式 → 标签池浮出
9. 从标签池点击添加 → 标签出现在标签云
10. 输入新标签名 + 配置颜色/可见性 → 创建成功
11. 供应商 Tab → 标签云 + 已合作勾选 + 评论正常
12. 窗口位置/大小持久化正常

- [ ] **Step 3: 最终提交（如有修复）**

```bash
git add -A
git commit -m "fix: 修复 Tab 合并后的 UI 问题"
```

---

## Self-Review

**1. Spec 覆盖度：**
- ✅ Tab 结构简化 → Task 8 (路由) + Task 9 (App.vue)
- ✅ 标签云 → Task 2 (TagCloud)
- ✅ 标签池 → Task 3 (TagPool)
- ✅ 标签创建器 → Task 4 (TagCreator)
- ✅ 标签数据模型 → Task 1 (store)
- ✅ 评论系统保持不变 → Task 5/6 合并保留
- ✅ 输入区模式切换 → Task 5/6 + Task 7 (sendLabel)
- ✅ 供应商合作状态 → Task 6
- ✅ 删除旧文件 → Task 10

**2. 无占位符：** 所有步骤包含完整代码，无 TBD/TODO。

**3. 类型一致性：** tag 对象在 store (Task 1)、TagCloud (Task 2)、TagPool (Task 3) 中的字段名完全一致：`id, text, font_color, bg_color, visibility, creator, created_at, like_count`。

**4. 接口一致：** TagCloud emit `like/remove`，TagPool emit `assign/remove`，TagCreator emit `create`。页面组件中全部对齐。
