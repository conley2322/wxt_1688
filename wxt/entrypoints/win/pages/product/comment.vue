<script setup>
import { ref, computed } from 'vue'
import { useApiStore } from '@/entrypoints/stores/api/api.js'
import CommentItem from '@/entrypoints/win/components/CommentItem.vue'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import UserFilter from '@/entrypoints/win/components/UserFilter.vue'

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