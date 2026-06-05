<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../utils/useApi.js'

const users = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const dialogVisible = ref(false)
const form = ref({ username: '', email: '', password: '', role: 'user' })

onMounted(async () => {
  console.log('[UserManage] 挂载')
  await loadUsers()
})

async function loadUsers() {
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      page_size: pageSize.value
    })
    const res = await api(`/api/v1/users?${params}`, 'GET')
    console.log('[UserManage] 用户列表:', res)
    if (res.code === 200) {
      users.value = res.data || res
      total.value = res.total || users.value.length
    }
  } catch (e) { console.error('[UserManage] 加载失败:', e) }
}

async function addUser() {
  if (!form.value.username || !form.value.password) { ElMessage.warning('请填写用户名和密码'); return }
  try {
    const res = await api('/api/v1/users', 'POST', form.value)
    console.log('[UserManage] 创建用户:', res)
    if (res.code === 200) {
      ElMessage.success('创建成功')
      dialogVisible.value = false
      form.value = { username: '', email: '', password: '', role: 'user' }
      loadUsers()
    } else { ElMessage.error(res.message || '创建失败') }
  } catch (e) { ElMessage.error('创建失败') }
}

async function toggleStatus(user) {
  console.log('[UserManage] 切换状态:', user.id, user.status)
  try {
    const res = await api(`/api/v1/users/${user.id}`, 'PUT', { status: user.status === 1 ? 0 : 1 })
    console.log('[UserManage] 切换结果:', res)
    ElMessage.success(user.status === 1 ? '已禁用' : '已启用')
    loadUsers()
  } catch (e) { ElMessage.error('操作失败') }
}

async function deleteUser(user) {
  try {
    await ElMessageBox.confirm(`确定删除「${user.username}」？`, '删除用户', { type: 'warning' })
    const res = await api(`/api/v1/users/${user.id}`, 'DELETE')
    console.log('[UserManage] 删除:', res)
    ElMessage.success('已删除')
    loadUsers()
  } catch {}
}

function handlePageChange(page) {
  currentPage.value = page
  loadUsers()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadUsers()
}

function statusType(s) { return s === 1 ? 'success' : 'danger' }
</script>
<template>
  <section>
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <el-button type="primary" @click="dialogVisible = true">添加用户</el-button>
    </div>
    <el-card>
      <el-table :data="users" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column label="角色" width="80"><template #default="{ row }"><el-tag :type="row.role === 'admin' ? 'warning' : 'info'" size="small">{{ row.role === 'admin' ? '管理员' : '用户' }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag></template></el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">{{ row.status === 1 ? '禁用' : '启用' }}</el-button>
            <el-button size="small" type="danger" @click="deleteUser(row)" v-if="row.username !== '1'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > 0" class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
      <el-empty v-else description="暂无用户" />
    </el-card>
    <el-dialog v-model="dialogVisible" title="添加用户" width="420px">
      <el-form :model="form" label-width="70px">
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="角色"><el-select v-model="form.role"><el-option label="普通用户" value="user" /><el-option label="管理员" value="admin" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="addUser">确定</el-button></template>
    </el-dialog>
  </section>
</template>
<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.pagination { display: flex; justify-content: center; padding: 16px 0; }
</style>