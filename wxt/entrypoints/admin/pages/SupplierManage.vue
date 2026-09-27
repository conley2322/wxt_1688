<script setup>
import { ref, watch, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'
import SupplierCard from '../components/SupplierCard.vue'

const suppliers = ref([])
const loading = ref(false)
const searchText = ref('')

// 筛选类型：all / commented / viewed（点击顶部统计卡片切换）
const filterType = ref('all')

// 分页
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 页头统计（由后端返回，不受筛选/搜索影响）
const stats = ref({ total: 0, commented: 0, viewed: 0, totalProducts: 0 })

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

// 点击统计卡片快捷筛选
function onFilter(type) {
  filterType.value = type
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
    <h2 class="page-title">供应商管理</h2>

    <!-- 概览统计卡片（点击即可筛选） -->
    <div class="overview-cards">
      <div
        class="ov-card" :class="{ active: filterType === 'all' }"
        @click="onFilter('all')"
      >
        <div class="ov-num blue">{{ stats.total }}</div>
        <div class="ov-label">全部供应商</div>
      </div>
      <div
        class="ov-card" :class="{ active: filterType === 'commented' }"
        @click="onFilter('commented')"
      >
        <div class="ov-num orange">{{ stats.commented }}</div>
        <div class="ov-label">有留言</div>
      </div>
      <div
        class="ov-card" :class="{ active: filterType === 'viewed' }"
        @click="onFilter('viewed')"
      >
        <div class="ov-num gray">{{ stats.viewed }}</div>
        <div class="ov-label">仅浏览</div>
      </div>
      <div class="ov-card static">
        <div class="ov-num green">{{ stats.totalProducts }}</div>
        <div class="ov-label">关联商品总数</div>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchText"
        placeholder="搜索供应商名称"
        size="default"
        clearable
        style="width:280px"
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

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px;
}

/* 概览统计卡片 */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.ov-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all .2s;
}
.ov-card:hover { border-color: #c9975c; }
.ov-card.active { border-color: #c9975c; background: #fdf8f3; }
.ov-card.static { cursor: default; }
.ov-card.static:hover { border-color: #ebeef5; }
.ov-num { font-size: 22px; font-weight: 700; line-height: 1.2; }
.ov-num.blue { color: #1677ff; }
.ov-num.orange { color: #ff6a00; }
.ov-num.gray { color: #909399; }
.ov-num.green { color: #52c41a; }
.ov-label { font-size: 12px; color: #999; margin-top: 4px; }

.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.pagination {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}
</style>
