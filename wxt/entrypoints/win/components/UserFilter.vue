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