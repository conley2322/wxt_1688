<template>
  <el-popover placement="bottom-start" :width="240" trigger="click" :visible="open" @update:visible="open = $event">
    <template #reference>
      <span class="filter-trigger" @click="open = !open">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span class="filter-label">{{ selectedNames.length ? `已选${selectedNames.length}人` : '搜索用户' }}</span>
      </span>
    </template>
    <div class="filter-popover">
      <el-input v-model="searchText" placeholder="输入用户名..." size="small" clearable />
      <div class="filter-list">
        <label v-for="u in filteredUsers" :key="u.name" class="filter-item">
          <input type="checkbox" :value="u.name" v-model="selectedNames" />
          <span class="filter-name">{{ u.name }}</span>
          <span class="filter-count">({{ u.count }}条)</span>
        </label>
        <div v-if="filteredUsers.length === 0" class="filter-empty">无匹配用户</div>
      </div>
      <div class="filter-actions">
        <el-button size="small" @click="selectedNames = []">清除</el-button>
        <el-button size="small" type="primary" @click="apply">应用</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  users: { type: Array, required: true },
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
.filter-trigger {
  display: flex; align-items: center; gap: 4px;
  cursor: pointer; padding: 2px 6px; border-radius: 4px;
  font-size: 12px; color: #666;
}
.filter-trigger:hover { background: #f0f0f0; }
.filter-label { font-size: 11px; color: #999; }
.filter-list { max-height: 180px; overflow-y: auto; padding: 8px 0; }
.filter-item { display: flex; align-items: center; gap: 6px; padding: 5px 0; font-size: 13px; cursor: pointer; }
.filter-name { color: #333; }
.filter-count { color: #bbb; font-size: 11px; }
.filter-empty { color: #ccc; text-align: center; padding: 16px 0; font-size: 13px; }
.filter-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
</style>
