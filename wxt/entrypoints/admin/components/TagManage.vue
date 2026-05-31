<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from './useApi.js'

const allTags = ref([])
const dialogVisible = ref(false)
const form = ref({ text: '', font_color: '#fff', bg_color: '#409eff', visibility: 'public' })

onMounted(async () => {
  console.log('[TagManage] 挂载')
  await loadTags()
})

async function loadTags() {
  try {
    const res = await api('/api/v1/tags/pool', 'GET')
    console.log('[TagManage] 标签池:', res)
    if (res.code === 200) allTags.value = res.data
  } catch (e) { console.error('[TagManage] 加载失败:', e) }
}

async function addTag() {
  if (!form.value.text.trim()) { ElMessage.warning('请输入标签名'); return }
  try {
    const res = await api('/api/v1/tags', 'POST', form.value)
    console.log('[TagManage] 创建标签:', res)
    if (res.code === 200) {
      ElMessage.success('已创建')
      dialogVisible.value = false
      form.value = { text: '', font_color: '#fff', bg_color: '#409eff', visibility: 'public' }
      loadTags()
    } else { ElMessage.error(res.message || '创建失败') }
  } catch (e) { ElMessage.error('创建失败') }
}

async function toggleVisibility(tag) {
  const newVal = tag.visibility === 'public' ? 'private' : 'public'
  console.log('[TagManage] 切换可见性:', tag.id, tag.text, tag.visibility, '→', newVal)
  try {
    const res = await api(`/api/v1/tags/${tag.id}`, 'PUT', { visibility: newVal })
    console.log('[TagManage] 切换结果:', res)
    if (res.code === 200) {
      tag.visibility = newVal
      ElMessage.success(newVal === 'public' ? '已设为公开' : '已设为私有')
    } else {
      ElMessage.error(res.message || '操作失败')
    }
  } catch (e) {
    console.error('[TagManage] 切换失败:', e)
    ElMessage.error('操作失败')
  }
}

async function deleteTag(tag) {
  try {
    await ElMessageBox.confirm(`确定删除「${tag.text}」？所有关联也会移除。`, '删除标签', { type: 'warning' })
    const res = await api(`/api/v1/tags/${tag.id}`, 'DELETE')
    console.log('[TagManage] 删除:', res)
    ElMessage.success('已删除')
    loadTags()
  } catch {}
}
</script>
<template>
  <section>
    <div class="page-header">
      <h2 class="page-title">标签池管理</h2>
      <el-button type="primary" @click="dialogVisible = true">添加标签</el-button>
    </div>
    <el-card>
      <el-table :data="allTags" stripe>
        <el-table-column label="标签" width="200">
          <template #default="{ row }">
            <el-tag :color="row.bg_color" :style="{ color: row.font_color }" size="default">{{ row.text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creator" label="创建者" width="100" />
        <el-table-column label="可见性" width="120">
          <template #default="{ row }">
            <el-button size="small" :type="row.visibility === 'public' ? 'success' : 'info'" @click="toggleVisibility(row)">
              {{ row.visibility === 'public' ? '公开' : '私有' }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }"><el-button size="small" type="danger" @click="deleteTag(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="allTags.length === 0" description="暂无标签" />
    </el-card>
    <el-dialog v-model="dialogVisible" title="添加标签" width="400px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标签名"><el-input v-model="form.text" placeholder="输入标签名（最多10字）" maxlength="10" show-word-limit /></el-form-item>
        <el-form-item label="文字颜色"><el-color-picker v-model="form.font_color" /></el-form-item>
        <el-form-item label="背景颜色"><el-color-picker v-model="form.bg_color" /></el-form-item>
        <el-form-item label="可见性">
          <el-radio-group v-model="form.visibility">
            <el-radio value="public">公开</el-radio>
            <el-radio value="private">私有</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="addTag">确定</el-button></template>
    </el-dialog>
  </section>
</template>
<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
</style>
