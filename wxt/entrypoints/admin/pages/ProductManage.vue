<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/useApi.js'
import { List, Grid } from '@element-plus/icons-vue'
import ProductMasonryCard from '../components/ProductMasonryCard.vue'

const products = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const drawerVisible = ref(false)
const currentProduct = ref(null)
const productComments = ref([])
const loadingDetail = ref(false)

// 搜索和排序
const searchText = ref('')
const searchType = ref('title')
const sortBy = ref('')
const sortOrder = ref('desc')

// 笔记状态筛选：''=全部 / commented=有笔记 / uncommented=仅浏览
const commentStatus = ref('')
const statsOverview = ref({ total: 0, commented: 0, uncommented: 0, total_views: 0 })

onMounted(loadProducts)

async function loadProducts() {
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      page_size: pageSize.value
    })
    if (searchText.value) { params.set('search', searchText.value); params.set('search_type', searchType.value) }
    if (sortBy.value) { params.set('sort_by', sortBy.value); params.set('sort_order', sortOrder.value) }
    if (commentStatus.value) params.set('comment_status', commentStatus.value)

    const res = await api(`/api/v1/products/mine?${params}`, 'GET')
    if (res.code === 200) {
      products.value = res.data
      total.value = res.total || res.data.length
      if (res.stats) statsOverview.value = res.stats
    }
  } catch (e) { console.error('[ProductManage] 加载失败:', e) }
}

function onSearch() {
  currentPage.value = 1
  loadProducts()
}

function productUrl(offerId) {
  return `https://detail.1688.com/offer/${offerId}.html`
}

// 点击统计卡片快捷筛选
function onStatusFilter(status) {
  commentStatus.value = commentStatus.value === status ? '' : status
  currentPage.value = 1
  loadProducts()
}

function onSort(by) {
  if (sortBy.value === by) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = by
    sortOrder.value = 'desc'
  }
  currentPage.value = 1
  loadProducts()
}

function clearFilter() {
  searchText.value = ''
  sortBy.value = ''
  commentStatus.value = ''
  currentPage.value = 1
  loadProducts()
}

function handlePageChange(page) {
  currentPage.value = page
  loadProducts()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadProducts()
}

async function openDrawer(row) {
  currentProduct.value = row
  drawerVisible.value = true
  loadingDetail.value = true
  try {
    const commentsRes = await api(`/api/v1/products/${row.offer_id}/comments`, 'GET')
    if (commentsRes.code === 200) productComments.value = commentsRes.data
  } catch (e) { console.error(e) }
  loadingDetail.value = false
}

// 时间格式化（ISO → MM-DD HH:mm）
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return iso
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 视图模式：table 表格 / masonry 瀑布流
const viewMode = ref('table')
</script>
<template>
  <section>
    <h2 class="page-title">商品管理 <span class="page-count">({{ total }})</span></h2>

    <!-- 概览统计卡片（点击即可筛选） -->
    <div class="overview-cards">
      <div
        class="ov-card" :class="{ active: commentStatus === '' }"
        @click="onStatusFilter('')"
      >
        <div class="ov-num blue">{{ statsOverview.total }}</div>
        <div class="ov-label">全部商品</div>
      </div>
      <div
        class="ov-card" :class="{ active: commentStatus === 'commented' }"
        @click="onStatusFilter('commented')"
      >
        <div class="ov-num orange">{{ statsOverview.commented }}</div>
        <div class="ov-label">有笔记</div>
      </div>
      <div
        class="ov-card" :class="{ active: commentStatus === 'uncommented' }"
        @click="onStatusFilter('uncommented')"
      >
        <div class="ov-num gray">{{ statsOverview.uncommented }}</div>
        <div class="ov-label">仅浏览</div>
      </div>
      <div class="ov-card static">
        <div class="ov-num green">{{ statsOverview.total_views }}</div>
        <div class="ov-label">累计浏览次数</div>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input v-model="searchText" placeholder="搜索标题或笔记..." style="width:260px" clearable @clear="onSearch"
        @keyup.enter="onSearch">
        <template #prepend>
          <el-select v-model="searchType" style="width:80px">
            <el-option label="标题" value="title" />
            <el-option label="笔记" value="comment" />
          </el-select>
        </template>
      </el-input>
      <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>

      <el-button v-if="searchText || commentStatus" style="margin-left:8px" @click="clearFilter">清除筛选</el-button>
    </div>

    <!-- 排序 -->
    <div class="sort-bar">
      <span class="sort-label">排序：</span>
      <el-button size="small" text @click="onSort('view_count')">浏览 {{ sortBy === 'view_count' ? (sortOrder === 'asc' ?
        '↑'
        : '↓') : '' }}</el-button>
      <el-button size="small" text @click="onSort('comment_count')">笔记 {{ sortBy === 'comment_count' ? (sortOrder ===
        'asc'
        ? '↑' : '↓') : '' }}</el-button>
      <el-button size="small" text @click="onSort('')">最近浏览</el-button>

      <!-- 视图切换 -->
      <div class="view-toggle">
        <el-button :type="viewMode === 'table' ? 'primary' : ''" size="small" @click="viewMode = 'table'">
          <el-icon><List /></el-icon>
        </el-button>
        <el-button :type="viewMode === 'masonry' ? 'primary' : ''" size="small" @click="viewMode = 'masonry'">
          <el-icon><Grid /></el-icon>
        </el-button>
      </div>
    </div>

    <el-card>
      <el-empty v-if="products.length === 0" description="暂无商品" />
      <template v-else>
        <!-- 表格视图 -->
        <el-table v-if="viewMode === 'table'" :data="products" stripe @row-click="openDrawer" row-class-name="clickable-row">
          <el-table-column label="图片" width="70">
            <template #default="{ row }">
              <el-image v-if="row.main_img_url" :src="row.main_img_url" style="width:48px;height:48px;border-radius:4px"
                fit="cover" />
              <div v-else
                style="width:48px;height:48px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:20px">
                ?</div>
            </template>
          </el-table-column>
          <el-table-column label="标题" min-width="120">
            <template #default="{ row }">
              <a :href="productUrl(row.offer_id)" target="_blank" class="product-link" @click.stop>{{ row.title }}</a>
            </template>
          </el-table-column>
          <el-table-column label="笔记状态" min-width="150">
            <template #default="{ row }">
              <el-tag v-if="row.comment_count > 0" type="warning" size="small" effect="light">
                已记录 {{ row.comment_count }} 条
              </el-tag>
              <span v-else class="no-note">未记录</span>
            </template>
          </el-table-column>
          <el-table-column prop="view_count" label="浏览" width="70" align="center" />
        </el-table>

        <!-- 瀑布流视图 -->
        <div v-else class="masonry-grid">
          <ProductMasonryCard
            v-for="row in products"
            :key="row.offer_id"
            :product="row"
            @click="openDrawer"
          />
        </div>
        <div class="pagination">
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
      </template>
    </el-card>

    <!-- 商品详情抽屉 -->
    <el-drawer v-model="drawerVisible" :title="currentProduct?.title || '商品详情'" size="420px">
      <template v-if="currentProduct">
        <div class="drawer-product">
          <el-image v-if="currentProduct.main_img_url" :src="currentProduct.main_img_url"
            style="width:100%;max-height:260px;border-radius:8px;margin-bottom:16px" fit="cover" />
          <h3 class="drawer-title">{{ currentProduct.title }}</h3>
          <p class="drawer-meta">供应商：{{ currentProduct.supplier_name || '未知' }}</p>
          <p class="drawer-meta">浏览 {{ currentProduct.view_count }} 次 · {{ currentProduct.comment_count }} 条笔记</p>
          <el-divider />
          <h4 class="drawer-section-title">我的笔记</h4>
          <div v-if="productComments.length" class="drawer-comments">
            <div v-for="c in productComments" :key="c.id" class="drawer-comment-item">
              <div class="drawer-cmt-avatar">我</div>
              <div class="drawer-cmt-body">
                <div class="drawer-cmt-header"><span
                    class="drawer-cmt-time">{{ fmtTime(c.updated_at || c.created_at) }}</span></div>
                <div class="drawer-cmt-text" v-html="c.text"></div>
              </div>
            </div>
          </div>
          <div v-else class="no-data">暂无笔记</div>
        </div>
      </template>
      <div v-if="loadingDetail" style="text-align:center;padding:40px">加载中...</div>
    </el-drawer>
  </section>
</template>
<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px;
}

.page-count {
  font-size: 14px;
  color: #999;
  font-weight: 400;
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

.search-bar {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}

.sort-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 16px;
}

.sort-label {
  font-size: 13px;
  color: #999;
}

.view-toggle {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.product-link {
  color: #303133;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-link:hover {
  color: #c9975c;
}

.no-note { font-size: 12px; color: #c0c4cc; }

:deep(.clickable-row) {
  cursor: pointer;
}

:deep(.clickable-row:hover) {
  background: #f5f7fa !important;
}

.drawer-title {
  font-size: 16px;
  color: #303133;
  margin: 0 0 8px;
  line-height: 1.5;
}

.drawer-meta {
  font-size: 13px;
  color: #999;
  margin: 0 0 4px;
}

.drawer-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin: 0 0 10px;
}

.no-data {
  color: #ccc;
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}

.drawer-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-comment-item {
  display: flex;
  gap: 10px;
}

.drawer-cmt-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #c9975c;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.drawer-cmt-body {
  flex: 1;
  min-width: 0;
}

.drawer-cmt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.drawer-cmt-time {
  font-size: 11px;
  color: #bbb;
}

.drawer-cmt-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  word-break: break-word;
}

.drawer-cmt-text :deep(ul),
.drawer-cmt-text :deep(ol) {
  padding-left: 16px;
  margin: 4px 0;
}

.pagination {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

/* 瀑布流布局 */
.masonry-grid {
  column-count: 8;
  column-gap: 12px;
  text-align: left;
}
</style>
