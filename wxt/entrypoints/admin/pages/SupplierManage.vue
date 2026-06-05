<script setup>
import { ref, computed, onMounted } from 'vue'
import { Shop, Search } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'
import SupplierCard from '../components/SupplierCard.vue'

const suppliers = ref([])
const loading = ref(false)
const searchText = ref('')

// 筛选类型：all / commented / viewed
const filterType = ref('all')

onMounted(async () => {
  await loadSuppliers()
})

async function loadSuppliers() {
  loading.value = true
  try {
    const res = await api('/api/v1/suppliers/my-suppliers', 'GET')
    if (res.code === 200) {
      suppliers.value = res.data || []
    }
  } catch (e) {
    console.error('加载供应商失败:', e)
  } finally {
    loading.value = false
  }
}

const filteredSuppliers = computed(() => {
  let list = suppliers.value

  // 按类型筛选
  if (filterType.value === 'commented') {
    list = list.filter(s => s.comment_count > 0)
  } else if (filterType.value === 'viewed') {
    list = list.filter(s => s.comment_count === 0)
  }

  // 搜索过滤
  if (searchText.value.trim()) {
    const kw = searchText.value.trim().toLowerCase()
    list = list.filter(s => s.supplier_name.toLowerCase().includes(kw))
  }

  return list
})

const stats = computed(() => ({
  total: suppliers.value.length,
  commented: suppliers.value.filter(s => s.comment_count > 0).length,
  totalProducts: suppliers.value.reduce((sum, s) => sum + s.product_count, 0),
}))
</script>

<template>
  <section class="supplier-page">
    <!-- 标题栏 -->
    <div class="page-header">
      <h2 class="page-title">
        <el-icon :size="20"><Shop /></el-icon>
        供应商管理
      </h2>
      <div class="page-stats">
        <span>{{ stats.total }} 个供应商</span>
        <span class="stat-sep">·</span>
        <span>{{ stats.commented }} 个有评论</span>
        <span class="stat-sep">·</span>
        <span>{{ stats.totalProducts }} 件商品</span>
      </div>
    </div>

    <!-- 筛选 + 搜索栏 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterType" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="commented">有评论</el-radio-button>
        <el-radio-button value="viewed">仅浏览</el-radio-button>
      </el-radio-group>

      <el-input
        v-model="searchText"
        placeholder="搜索供应商名称"
        size="small"
        clearable
        style="width:220px"
        :prefix-icon="Search"
      />
    </div>

    <!-- 供应商列表 -->
    <div v-loading="loading">
      <template v-if="filteredSuppliers.length > 0">
        <SupplierCard
          v-for="s in filteredSuppliers"
          :key="s.supplier_name"
          :supplier="s"
        />
      </template>
      <el-empty v-else description="暂无关联的供应商" />
    </div>
  </section>
</template>

<style scoped>
.supplier-page {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 48px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-stats {
  font-size: 13px;
  color: #94a3b8;
}

.stat-sep {
  margin: 0 6px;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
