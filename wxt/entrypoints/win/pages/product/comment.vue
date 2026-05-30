<script setup>
import { ref, computed, nextTick } from 'vue'
import { useApiStore } from '@/stores/api/api.js'
import TagCloud from '@/entrypoints/win/components/TagCloud.vue'
import TagPool from '@/entrypoints/win/components/TagPool.vue'
import InputSettings from '@/entrypoints/win/components/InputSettings.vue'
import CommentItem from '@/entrypoints/win/components/CommentItem.vue'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import UserFilter from '@/entrypoints/win/components/UserFilter.vue'

const store = useApiStore()

// ── 输入模式：'comment' | 'tag' ──
const inputMode = ref('comment')

// ── 标签创建配置 ──
const tagFontColor = ref('#fff')
const tagBgColor = ref('#2ecc71')
const tagVisibility = ref('public')

// 当前输入框文本（用于判断是否显示配置）
const inputText = ref('')
const commentInputRef = ref(null)

// ── 是否已评论（一用户一评论） ──
const myComment = computed(() =>
  store.productComments.find(c => c.user_name === store.currentUser.name)
)
const isEditing = computed(() => inputMode.value === 'comment' && !!myComment.value)

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
function handleSend(text) {
  if (inputMode.value === 'comment') {
    if (isEditing.value) {
      store.updateProductComment(myComment.value.id, text)
    } else {
      store.addProductComment(text)
    }
  } else {
    // 标签模式：创建新标签并分配
    const tag = store.createTag(text, tagFontColor.value, tagBgColor.value, tagVisibility.value)
    store.assignTagToProduct(tag.id)
    tagFontColor.value = '#fff'
    tagBgColor.value = '#2ecc71'
    tagVisibility.value = 'public'
  }
}

// ── 标签操作 ──
function handleTagToggleLike(tagId) {
  store.toggleProductTagLike(tagId)
}

function handleTagRemove(tagId) {
  store.removeTagFromProduct(tagId)
}

function handleTagAssign(tagId) {
  store.assignTagToProduct(tagId)
}

function onSwitchToComment() {
  inputMode.value = 'comment'
  if (myComment.value) {
    nextTick(() => {
      commentInputRef.value?.setText(myComment.value.text)
    })
  }
}
</script>

<template>
  <div class="product-page">
    <!-- 标签云 -->
    <TagCloud
      :tags="store.productAssignedTags"
      :currentUser="store.currentUser.name"
      @toggle-like="handleTagToggleLike"
      @remove="handleTagRemove"
    />

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
        @toggle-like="(id) => store.toggleLike(id)"
      />
      <div v-if="filteredComments.length === 0" class="empty">暂无评论</div>
    </div>

    <!-- 标签模式：标签池 -->
    <TagPool
      v-if="inputMode === 'tag'"
      :availableTags="store.productAvailableTags"
      :assignedTags="store.productAssignedTags"
      @assign="handleTagAssign"
      @remove="handleTagRemove"
    />

    <!-- 输入区 -->
    <div class="input-area">
      <!-- 标签创建配置（仅标签模式且有输入内容时显示） -->
      <InputSettings
        v-if="inputMode === 'tag' && inputText.trim()"
        :fontColor="tagFontColor"
        :bgColor="tagBgColor"
        :visibility="tagVisibility"
        @update:fontColor="tagFontColor = $event"
        @update:bgColor="tagBgColor = $event"
        @update:visibility="tagVisibility = $event"
      />

      <CommentInput
        ref="commentInputRef"
        :userInitial="store.currentUser.initial"
        :userColor="store.currentUser.color"
        :placeholder="inputPlaceholder"
        :sendLabel="inputSendLabel"
        @send="handleSend"
        @update:text="inputText = $event"
      />
      <div class="mode-switch">
        <span
          class="mode-btn"
          :class="{ active: inputMode === 'comment' }"
          @click="onSwitchToComment"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          评论
        </span>
        <span
          class="mode-btn"
          :class="{ active: inputMode === 'tag' }"
          @click="inputMode = 'tag'"
        >
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
</style>
