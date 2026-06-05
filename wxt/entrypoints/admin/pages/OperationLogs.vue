<script setup>
import { ref, onMounted } from 'vue'
import { Clock } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'

const logs = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 30
const total = ref(0)

onMounted(() => loadLogs())

async function loadLogs() {
  loading.value = true
  try {
    const res = await api(`/api/v1/operations/logs?page=${currentPage.value}&page_size=${pageSize}`, 'GET')
    if (res.code === 200) {
      logs.value = res.data || []
      total.value = res.total || 0
    }
  } catch (e) {
    console.error('[Operations] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

function onPageChange(page) {
  currentPage.value = page
  loadLogs()
}

function formatTime(iso) {
  if (!iso) return ''
  return iso.replace('T', ' ').substring(0, 16)
}
</script>

<template>
  <section class="ops-page">
    <h2 class="page-title">
      <el-icon :size="20" color="#6366f1"><Clock /></el-icon>
      操作记录
    </h2>

    <el-card shadow="hover">
      <div v-loading="loading">
        <template v-if="logs.length > 0">
          <div class="log-list">
            <div v-for="log in logs" :key="log.id" class="log-item">
              <div class="log-detail">{{ log.detail }}</div>
              <div class="log-meta">
                <span class="log-user">{{ log.username }}</span>
                <span class="log-time">{{ formatTime(log.created_at) }}</span>
              </div>
            </div>
          </div>

          <div class="pagination-wrap" v-if="total > pageSize">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              layout="prev, pager, next"
              @current-change="onPageChange"
            />
          </div>
        </template>
        <el-empty v-else description="暂无操作记录" :image-size="60" />
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.ops-page { max-width: 920px; margin: 0 auto; padding-bottom: 48px; }
.page-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 20px; display: flex; align-items: center; gap: 8px; }

.log-list { max-height: none; }
.log-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid #f1f5f9; gap: 16px;
}
.log-item:last-child { border-bottom: none; }
.log-detail { font-size: 13px; color: #475569; line-height: 1.5; flex: 1; min-width: 0; }
.log-meta { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.log-user { font-size: 12px; color: #6366f1; font-weight: 500; }
.log-time { font-size: 11px; color: #94a3b8; white-space: nowrap; }
.pagination-wrap { display: flex; justify-content: center; padding: 20px 0 8px; }
</style>
