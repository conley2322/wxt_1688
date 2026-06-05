<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../utils/useApi.js'
import { Clock } from '@element-plus/icons-vue'

const router = useRouter()

const userCount = ref(0)
const tagCount = ref(0)
const productCount = ref(0)
const logs = ref([])
const loadingLogs = ref(false)

onMounted(async () => {
  try {
    const [u, t, p] = await Promise.all([
      api('/api/v1/users', 'GET'),
      api('/api/v1/tags/pool', 'GET'),
      api('/api/v1/products/mine', 'GET'),
    ])
    if (u.code === 200) userCount.value = (u.data || u).length
    if (t.code === 200) tagCount.value = t.data.length
    if (p.code === 200) productCount.value = p.total || p.data.length
  } catch (e) { console.error('[Dashboard] 加载统计失败:', e) }

 // await loadLogs()
})

async function loadLogs() {
  loadingLogs.value = true
  try {
    const res = await api('/api/v1/operations/logs?page_size=6', 'GET')
    if (res.code === 200) {
      logs.value = res.data || []
    }
  } catch (e) { console.error('[Dashboard] 加载日志失败:', e) }
  finally { loadingLogs.value = false }
}

function formatTime(iso) {
  if (!iso) return ''
  return iso.replace('T', ' ').substring(0, 16)
}
</script>

<template>
  <section>
    <h2 class="page-title">概览</h2>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom:24px">
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="用户总数" :value="userCount"><template #prefix><el-icon color="#c9975c"><User /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="标签总数" :value="tagCount"><template #prefix><el-icon color="#67c23a"><CollectionTag /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="浏览商品" :value="productCount"><template #prefix><el-icon color="#409eff"><Goods /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="系统状态" value="运行中"><template #prefix><el-icon color="#67c23a"><CircleCheck /></el-icon></template></el-statistic></el-card></el-col>
    </el-row>

    <!-- 操作日志 -->
  <!--   <el-card shadow="hover">
      <template #header>
        <div class="log-header">
          <el-icon :size="16" color="#6366f1"><Clock /></el-icon>
          <span>最近操作</span>
          <el-button size="small" text type="primary" style="margin-left:auto" @click="router.push('/operations')">
            查看全部
          </el-button>
        </div>
      </template>

      <div v-loading="loadingLogs">
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
        </template>
        <el-empty v-else description="暂无操作记录" :image-size="60" />
      </div>
    </el-card> -->
  </section>
</template>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0 0 20px; }

/* 日志区块 */
.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.log-list {
  max-height: 480px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  gap: 16px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-detail {
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
  flex: 1;
  min-width: 0;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.log-user {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
}

.log-time {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}
</style>
