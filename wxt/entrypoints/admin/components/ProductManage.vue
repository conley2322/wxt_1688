<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from './useApi.js'

const products = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const drawerVisible = ref(false)
const currentProduct = ref(null)
const productTags = ref({ mine: [], others: [] })
const productComments = ref([])
const loadingDetail = ref(false)

// 搜索和排序
const searchText = ref('')
const searchType = ref('title')
const selectedTagId = ref('')
const allMyTags = ref([])
const sortBy = ref('')
const sortOrder = ref('desc')

onMounted(async () => {
  console.log('[ProductManage] 挂载')
  await Promise.all([loadProducts(), loadMyTags()])
})

async function loadProducts() {
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      page_size: pageSize.value
    })
    if (searchText.value) { params.set('search', searchText.value); params.set('search_type', searchType.value) }
    if (selectedTagId.value) params.set('tag_id', selectedTagId.value)
    if (sortBy.value) { params.set('sort_by', sortBy.value); params.set('sort_order', sortOrder.value) }

    const res = await api(`/api/v1/products/mine?${params}`, 'GET')
    console.log('[ProductManage] 商品列表:', res)
    if (res.code === 200) { 
      products.value = res.data; 
      total.value = res.total || res.data.length 
    }
  } catch (e) { console.error('[ProductManage] 加载失败:', e) }
}

async function loadMyTags() {
  try {
    const res = await api('/api/v1/tags/pool', 'GET')
    if (res.code === 200) allMyTags.value = res.data
  } catch { }
}

function productUrl(offerId) {
  return `https://detail.1688.com/offer/${offerId}.html`
}

function onSearch() {
  selectedTagId.value = ''
  currentPage.value = 1
  loadProducts()
}

function onTagSelect(tagId) {
  searchText.value = ''
  selectedTagId.value = tagId
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
  selectedTagId.value = ''
  sortBy.value = ''
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
    const [tagsRes, commentsRes] = await Promise.all([
      api(`/api/v1/products/${row.offer_id}/tags`, 'GET'),
      api(`/api/v1/products/${row.offer_id}/comments`, 'GET'),
    ])
    if (tagsRes.code === 200) productTags.value = tagsRes.data
    if (commentsRes.code === 200) productComments.value = commentsRes.data
  } catch (e) { console.error(e) }
  loadingDetail.value = false
}

const selectedTagLabel = computed(() => {
  const t = allMyTags.value.find(t => t.id === selectedTagId.value)
  return t ? t.text : ''
})
</script>
<template>
  <section>
    <h2 class="page-title">商品管理 <span class="page-count">({{ total }})</span></h2>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input v-model="searchText" placeholder="搜索标题或评论..." style="width:260px" clearable @clear="onSearch"
        @keyup.enter="onSearch">
        <template #prepend>
          <el-select v-model="searchType" style="width:80px">
            <el-option label="标题" value="title" />
            <el-option label="评论" value="comment" />
          </el-select>
        </template>
      </el-input>
      <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>

      <!-- 标签下拉筛选 -->
      <el-dropdown v-if="allMyTags.length" style="margin-left:12px" @command="onTagSelect">
        <el-button :type="selectedTagId ? 'warning' : ''">
          {{ selectedTagLabel || '按标签筛选' }}<el-icon class="el-icon--right">
            <ArrowDown />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="tag in allMyTags" :key="tag.id" :command="tag.id">
              <el-tag :color="tag.bg_color" :style="{ color: tag.font_color }" size="small">{{ tag.text }}</el-tag>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button v-if="searchText || selectedTagId" style="margin-left:8px" @click="clearFilter">清除筛选</el-button>
    </div>

    <!-- 排序 -->
    <div class="sort-bar">
      <span class="sort-label">排序：</span>
      <el-button size="small" text @click="onSort('view_count')">浏览 {{ sortBy === 'view_count' ? (sortOrder === 'asc' ?
        '↑'
        : '↓') : '' }}</el-button>
      <el-button size="small" text @click="onSort('comment_count')">评论 {{ sortBy === 'comment_count' ? (sortOrder ===
        'asc'
        ? '↑' : '↓') : '' }}</el-button>
      <el-button size="small" text @click="onSort('')">默认</el-button>
    </div>

    <el-card>
      <el-empty v-if="products.length === 0" description="暂无商品" />
      <template v-else>
        <el-table :data="products" stripe @row-click="openDrawer" row-class-name="clickable-row">
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
          <el-table-column label="我的标签" width="180">
            <template #default="{ row }">
              <span v-if="row.tags && row.tags.length">
                <el-tag v-for="tag in row.tags" :key="tag.id" :color="tag.bg_color"
                  :style="{ color: tag.font_color, marginRight: '4px' }" size="small">{{ tag.text }}</el-tag>
              </span>
              <span v-else class="no-tags">—</span>
            </template>
          </el-table-column>
          <el-table-column label="我的评论" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.my_comment || '—' }}</template>
          </el-table-column>
          <el-table-column prop="comment_count" label="评论" width="70" align="center" />
          <el-table-column prop="view_count" label="浏览" width="70" align="center" />
        </el-table>
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
          <p class="drawer-meta">浏览 {{ currentProduct.view_count }} 次 · {{ currentProduct.comment_count }} 条评论</p>
          <el-divider />
          <h4 class="drawer-section-title">全部标签</h4>
          <div v-if="productTags.mine.length || productTags.others.length" class="drawer-tags">
            <el-tag v-for="tag in productTags.mine" :key="tag.id" :color="tag.bg_color"
              :style="{ color: tag.font_color, marginRight: '6px', marginBottom: '6px' }" size="default">{{ tag.text
              }}<span style="opacity:0.6;font-size:10px;margin-left:2px">(我)</span></el-tag>
            <el-tag v-for="tag in productTags.others" :key="tag.id" :color="tag.bg_color"
              :style="{ color: tag.font_color, marginRight: '6px', marginBottom: '6px', opacity: 0.7 }"
              size="default">{{ tag.text }}<span style="opacity:0.5;font-size:10px;margin-left:2px">({{ tag.creator
                }})</span></el-tag>
          </div>
          <div v-else class="no-data">暂无标签</div>
          <el-divider />
          <h4 class="drawer-section-title">全部评论</h4>
          <div v-if="productComments.length" class="drawer-comments">
            <div v-for="c in productComments" :key="c.id" class="drawer-comment-item">
              <div class="drawer-cmt-avatar">{{ c.username.charAt(0).toUpperCase() }}</div>
              <div class="drawer-cmt-body">
                <div class="drawer-cmt-header"><span class="drawer-cmt-name">{{ c.username }}</span><span
                    class="drawer-cmt-time">{{ c.created_at }}</span></div>
                <div class="drawer-cmt-text" v-html="c.text"></div>
              </div>
            </div>
          </div>
          <div v-else class="no-data">暂无评论</div>
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

.product-link {
  color: #303133;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-link:hover {
  color: #c9975c;
}

.no-tags {
  color: #ccc;
}

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

.drawer-tags {
  display: flex;
  flex-wrap: wrap;
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

.drawer-cmt-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
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
</style>