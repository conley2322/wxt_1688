<script setup>
import { ref, computed } from 'vue'
import { useApiStore } from '@/entrypoints/stores/api/api.js'
import CommentItem from '@/entrypoints/win/components/CommentItem.vue'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import UserFilter from '@/entrypoints/win/components/UserFilter.vue'

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