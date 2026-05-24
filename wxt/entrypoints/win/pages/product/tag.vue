<script setup>
import { ref } from 'vue'
import { useApiStore } from '@/entrypoints/stores/api/api.js'
import TagChip from '@/entrypoints/win/components/TagChip.vue'

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