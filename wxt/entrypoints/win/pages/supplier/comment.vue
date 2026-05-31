<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useApiStore } from '@/stores/api/api.js'
import TagCloud from '@/entrypoints/win/components/TagCloud.vue'

import TagPool from '@/entrypoints/win/components/TagPool.vue'
import InputSettings from '@/entrypoints/win/components/InputSettings.vue'
import CommentItem from '@/entrypoints/win/components/CommentItem.vue'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import UserFilter from '@/entrypoints/win/components/UserFilter.vue'

const store = useApiStore()

const inputMode = ref('comment')

// ── 标签创建配置 ──
const tagFontColor = ref('#fff')
const tagBgColor = ref('#2ecc71')
const tagVisibility = ref('public')
const inputText = ref('')
const commentInputRef = ref(null)
const tagInputRef = ref(null)
const tagInputText = ref('')

// ── 监听 currentSupplierName，设置后自动加载数据 ──
watch(() => store.currentSupplierName, async (name) => {
  if (!name) return
  await Promise.all([
    store.fetchSupplierComments(name),
    store.fetchSupplierTags(name),
    store.fetchTagPool(),
    store.fetchCooperateStatus(name)
  ])
}, { immediate: true })

// ── 是否已评论（一用户一评论） ──
const myComment = computed(() =>
  store.supplierComments.find(c => c.username === store.currentUser.name)
)
const isEditing = ref(false)
const showCommentInput = computed(() =>
  inputMode.value === 'comment' && (!myComment.value || isEditing.value)
)

// ── 评论排序/筛选 ──
const sortOrder = ref('newest')
const filterUsers = ref([])

function toggleSort() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}

const sortLabel = computed(() => sortOrder.value === 'newest' ? '最新' : '最早')

const filteredComments = computed(() => {
  let list = [...store.supplierComments]
  if (filterUsers.value.length > 0) {
    list = list.filter(c => filterUsers.value.includes(c.username))
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
    map[c.username] = (map[c.username] || 0) + 1
  })
  return Object.entries(map).map(([name, count]) => ({ name, count }))
})

// ── 输入框配置 ──
const inputPlaceholder = computed(() => {
  if (inputMode.value === 'tag') return '输入标签名...'
  return isEditing.value ? '修改你的评论...' : '写点什么...'
})
const inputSendLabel = computed(() => {
  if (inputMode.value === 'tag') return '添加'
  return isEditing.value ? '修改' : '评论'
})

// ── 发送处理 ──
async function handleSend(text) {
  try {
    if (isEditing.value) {
      await store.updateSupplierComment(myComment.value.id, text)
      await store.fetchSupplierComments(store.currentSupplierName)
      isEditing.value = false
    } else {
      await store.addSupplierComment(store.currentSupplierName, text)
    }
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function handleTagSubmit() {
  const text = tagInputText.value.trim()
  if (!text) return
  try {
    const tag = await store.createTag(text, tagFontColor.value, tagBgColor.value, tagVisibility.value)
    await store.assignSupplierTag(store.currentSupplierName, tag.id)
    tagInputText.value = ''
    tagFontColor.value = '#fff'
    tagBgColor.value = '#2ecc71'
    tagVisibility.value = 'public'
    ElMessage.success('标签已添加')
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

// ── 标签操作 ──
async function handleTagRemove(tagId) {
  try {
    await ElMessageBox.confirm('确定要从供应商中移除该标签吗？', '移除标签', { type: 'warning', confirmButtonText: '移除', cancelButtonText: '取消' })
    await store.removeSupplierTag(store.currentSupplierName, tagId)
    ElMessage.success('标签已移除')
  } catch {}
}

async function handleTagAssign(tagId) {
  try {
    await store.assignSupplierTag(store.currentSupplierName, tagId)
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function handlePoolTagDelete(tagId) {
  try {
    await ElMessageBox.confirm('确定要删除这个标签吗？将从标签池中永久移除。', '删除标签', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
    await store.deleteTag(tagId)
    ElMessage.success('标签已删除')
  } catch {}
}

function onSwitchToComment() {
  inputMode.value = 'comment'
  isEditing.value = false
  tagInputText.value = ''
  nextTick(() => {
    commentInputRef.value?.setText('')
  })
}

function onSwitchToTag() {
  inputMode.value = 'tag'
  isEditing.value = false
  nextTick(() => {
    commentInputRef.value?.setText('')
  })
}

// ── 编辑/删除评论 ──
function handleEditComment(comment) {
  inputMode.value = 'comment'
  isEditing.value = true
  nextTick(() => {
    commentInputRef.value?.setText(comment.text)
  })
}

async function handleDeleteComment(commentId) {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除评论', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await store.deleteSupplierComment(commentId)
    await store.fetchSupplierComments(store.currentSupplierName)
    inputMode.value = 'comment'
    isEditing.value = false
    commentInputRef.value?.setText('')
    ElMessage.success('评论已删除')
  } catch {}
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
        @remove="handleTagRemove"
      />
      <label class="coop-check">
        <input type="checkbox" :checked="store.supplierCooperated" @change="store.toggleCooperate(store.currentSupplierName)" />
        <span class="coop-label" :class="{ coop: store.supplierCooperated }">
          <svg v-if="store.supplierCooperated" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>{{ store.supplierCooperated ? '已合作' : '标记为已合作' }}</span>
        </span>
      </label>
    </div>

    <!-- 评论工具栏 -->
    <div class="toolbar">
      <UserFilter :users="userList" @apply="(u) => filterUsers = u" />
      <span class="sort-btn" @click="toggleSort">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M3 12h12M3 18h6"/>
        </svg>
        {{ sortLabel }}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </span>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list">
      <CommentItem
        v-for="c in filteredComments"
        :key="c.id"
        :comment="c"
        :currentUser="store.currentUser.name"
        @edit="handleEditComment"
        @delete="handleDeleteComment"
      />
      <div v-if="filteredComments.length === 0" class="empty">暂无评论</div>
    </div>

    <!-- 标签池 -->
    <TagPool
      v-if="inputMode === 'tag'"
      :availableTags="store.supplierAvailableTags"
      @assign="handleTagAssign"
      @delete-tag="handlePoolTagDelete"
    />

    <!-- 输入区 -->
    <div class="input-area">
      <!-- 评论模式：富文本编辑器 -->
      <CommentInput
        v-if="showCommentInput"
        ref="commentInputRef"
        :userInitial="store.currentUser.initial"
        :userColor="store.currentUser.color"
        :placeholder="inputPlaceholder"
        :sendLabel="inputSendLabel"
        @send="handleSend"
        @update:text="inputText = $event"
      />

      <!-- 标签模式：简单输入框 -->
      <div v-else-if="inputMode === 'tag'" class="tag-input-row">
        <div class="tag-editor-header">
          <div class="editor-avatar" :style="{ background: store.currentUser.color }">{{ store.currentUser.initial }}</div>
          <InputSettings
            v-if="tagInputText.trim()"
            :fontColor="tagFontColor"
            :bgColor="tagBgColor"
            :visibility="tagVisibility"
            @update:fontColor="tagFontColor = $event"
            @update:bgColor="tagBgColor = $event"
            @update:visibility="tagVisibility = $event"
          />
        </div>
        <div class="tag-input-wrap">
          <input
            ref="tagInputRef"
            class="tag-input"
            v-model="tagInputText"
            placeholder="输入标签名..."
            @keydown.enter="handleTagSubmit"
          />
          <button class="tag-submit-btn" :disabled="!tagInputText.trim()" @click="handleTagSubmit">添加</button>
        </div>
      </div>
      <div class="mode-switch">
        <span class="mode-btn" :class="{ active: inputMode === 'comment' }" @click="onSwitchToComment">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          评论
        </span>
        <span class="mode-btn" :class="{ active: inputMode === 'tag' }" @click="onSwitchToTag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          标签
        </span>
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
  display: flex;
  align-items: center;
  gap: 3px;
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
  display: flex;
  align-items: center;
  gap: 3px;
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
  display: flex;
  align-items: center;
  gap: 3px;
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
.tag-input-row {
  border-top: 1px solid #f0f0f0;
  background: #fff;
}
.tag-editor-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 0;
}
.tag-input-row .editor-avatar {
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
.tag-input-wrap {
  display: flex;
  gap: 6px;
  padding: 6px 12px 8px;
}
.tag-input {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  outline: none;
}
.tag-input:focus {
  border-color: #1677ff;
  background: #fafafa;
}
.tag-submit-btn {
  border: none;
  background: #1677ff;
  color: #fff;
  font-size: 12px;
  padding: 5px 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
}
.tag-submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.tag-submit-btn:not(:disabled):hover {
  background: #4096ff;
}
</style>
