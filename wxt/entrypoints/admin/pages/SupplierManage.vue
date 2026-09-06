<script setup>
import { ref, watch, onMounted } from 'vue'
import { Shop, Search } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'
import SupplierCard from '../components/SupplierCard.vue'

const suppliers = ref([])
const loading = ref(false)
const searchText = ref('')

// 筛选类型：all / commented / viewed
const filterType = ref('all')

// 分页
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 页头统计（由后端返回，不受筛选/搜索影响）
const stats = ref({ total: 0, commented: 0, totalProducts: 0 })

onMounted(loadSuppliers)

async function loadSuppliers() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      page_size: pageSize.value,
      filter: filterType.value,
    })
    if (searchText.value.trim()) params.set('search', searchText.value.trim())

    const res = await api(`/api/v1/suppliers/my-suppliers?${params}`, 'GET')
    if (res.code === 200) {
      suppliers.value = res.data || []
      total.value = res.total || 0
      if (res.stats) stats.value = res.stats
    }
  } catch (e) {
    console.error('加载供应商失败:', e)
  } finally {
    loading.value = false
  }
}

// 搜索防抖：输入停顿 300ms 后自动查询
let searchTimer = null
watch(searchText, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    loadSuppliers()
  }, 300)
})

// 切换筛选类型
watch(filterType, () => {
  currentPage.value = 1
  loadSuppliers()
})

function handlePageChange(page) {
  currentPage.value = page
  loadSuppliers()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadSuppliers()
}
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
      <template v-if="suppliers.length > 0">
        <SupplierCard
          v-for="s in suppliers"
          :key="s.supplier_name"
          :supplier="s"
        />
      </template>
      <el-empty v-else-if="!loading" description="暂无关联的供应商" />
    </div>

    <!-- 分页 -->
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

.pagination {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}
</style>
