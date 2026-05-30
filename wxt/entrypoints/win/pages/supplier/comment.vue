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
