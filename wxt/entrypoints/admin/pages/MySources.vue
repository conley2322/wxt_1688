<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, ArrowRight, TopRight } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'

const groups = ref([])
const stats = ref({ total_suppliers: 0, suppliers_with_notes: 0, total_products: 0, products_with_notes: 0, total_views: 0, total_appears: 0 })
const loading = ref(false)
const searchText = ref('')

// 当前选中的供应商
const currentName = ref('')
const currentGroup = computed(() => groups.value.find(g => g.supplier_name === currentName.value) || null)

// ── 批量管理 ──
const batchMode = ref(false)
const selectedSet = ref(new Set())

// ── 商品详情（右侧滑出）──
const drawerVisible = ref(false)
const currentProduct = ref(null)
const detail = ref(null)
const detailLoading = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const qs = searchText.value.trim() ? `?search=${encodeURIComponent(searchText.value.trim())}` : ''
    const res = await api(`/api/v1/products/grouped${qs}`, 'GET')
    if (res.code === 200) {
      groups.value = res.data
      if (res.stats) stats.value = res.stats
      // 默认选中第一个供应商（grouped 接口已把有笔记的排最前）
      if (!currentName.value || !res.data.some(g => g.supplier_name === currentName.value)) {
        currentName.value = res.data[0]?.supplier_name || ''
      }
    }
  } catch (e) {
    console.error('[MySources] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

let searchTimer = null
watch(searchText, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})

const hasNotes = g => g.comment_count > 0 || g.products.some(p => p.comment_count > 0)

function selectSupplier(name) {
  currentName.value = name
}

// 商品详情页链接：有 offer_id 即可拼出，不依赖页面采集
function productUrl(offerId) {
  return `https://detail.1688.com/offer/${offerId}.html`
}

function pad(n) { return String(n).padStart(2, '0') }
function fmtDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── 商品详情 ──
async function openProduct(p) {
  if (batchMode.value) return
  currentProduct.value = p
  drawerVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    const res = await api(`/api/v1/products/${p.offer_id}/stats`, 'GET')
    if (res.code === 200) detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

// 近 30 天有出现/浏览的天（降序）
const viewedDays = computed(() => {
  if (!detail.value?.daily) return []
  return detail.value.daily.filter(x => x.view > 0 || x.appear > 0).reverse()
})

// ── 批量选择 ──
function isSelected(id) { return selectedSet.value.has(id) }
function toggleSelect(id) {
  const next = new Set(selectedSet.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedSet.value = next
}
function enterBatch() { batchMode.value = true }
function exitBatch() {
  batchMode.value = false
  selectedSet.value = new Set()
}
const selectedCount = computed(() => selectedSet.value.size)

async function batchDelete() {
  const ids = [...selectedSet.value]
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${ids.length} 个商品？关联的浏览记录、出现记录和笔记将全部删除，不可恢复。`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '全部删除', cancelButtonText: '取消' }
    )
  } catch { return }
  await api('/api/v1/products/batch-delete', 'POST', { offer_ids: ids })
  ElMessage.success('删除完成')
  exitBatch()
  load()
}

// ── 单个删除 ──
async function deleteProduct(p) {
  try {
    await ElMessageBox.confirm('确认删除该商品？其浏览记录和笔记将一并删除。', '删除商品', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    })
  } catch { return }
  await api(`/api/v1/products/${p.offer_id}`, 'DELETE')
  ElMessage.success('商品已删除')
  load()
}

async function deleteSupplier(g) {
  try {
    await ElMessageBox.confirm(
      `确认删除供应商「${g.supplier_name}」？名下 ${g.product_count} 个商品及全部浏览记录、笔记将一并删除。`,
      '删除供应商',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch { return }
  await api(`/api/v1/suppliers/${encodeURIComponent(g.supplier_name)}`, 'DELETE')
  ElMessage.success('供应商已删除')
  currentName.value = ''
  load()
}
</script>

<template>
  <section class="sources-page" v-loading="loading">
    <!-- 左栏：供应商列表 -->
    <aside class="supplier-pane">
      <div class="pane-search">
        <el-input v-model="searchText" placeholder="搜索供应商" clearable size="small" :prefix-icon="Search" />
      </div>
      <div class="supplier-list">
        <div
          v-for="g in groups"
          :key="g.supplier_name"
          class="supplier-item"
          :class="{ on: g.supplier_name === currentName }"
          @click="selectSupplier(g.supplier_name)"
        >
          <span v-if="hasNotes(g)" class="s-pin">📌</span>
          <div class="s-info">
            <div class="s-name">{{ g.supplier_name }}</div>
            <div class="s-meta">
              {{ g.product_count }} 件商品<template v-if="g.comment_count > 0"> · {{ g.comment_count }} 条笔记</template>
            </div>
          </div>
        </div>
        <div v-if="groups.length === 0" class="pane-empty">暂无供应商</div>
      </div>
    </aside>

    <!-- 右栏：商品行列表 -->
    <main class="product-pane">
      <template v-if="currentGroup">
        <header class="pane-head">
          <div class="head-title">
            {{ currentGroup.supplier_name }}
            <span class="head-meta">{{ currentGroup.product_count }} 件商品</span>
          </div>
          <div class="head-actions">
            <el-button v-if="!batchMode" size="small" @click="enterBatch">批量管理</el-button>
            <el-button v-else size="small" @click="exitBatch">退出批量</el-button>
            <el-button size="small" type="danger" plain :icon="Delete" @click="deleteSupplier(currentGroup)">删除供应商</el-button>
          </div>
        </header>

        <!-- 供应商笔记 -->
        <div v-if="currentGroup.supplier_comments.length" class="supplier-note">
          <div v-for="c in currentGroup.supplier_comments" :key="c.id" class="note-row">
            <div class="note-text" v-html="c.text"></div>
            <span class="note-time">{{ fmtDateTime(new Date(c.updated_at || c.created_at).getTime()) }}</span>
          </div>
        </div>

        <!-- 商品列表（一行一个） -->
        <div class="product-rows">
          <div
            v-for="p in currentGroup.products"
            :key="p.offer_id"
            class="product-row"
            @click="openProduct(p)"
          >
            <el-checkbox
              v-if="batchMode"
              :model-value="isSelected(p.offer_id)"
              class="row-check"
              @change="toggleSelect(p.offer_id)"
              @click.stop
            />
            <el-image
              v-if="p.main_img_url"
              :src="p.main_img_url"
              class="row-img"
              fit="cover"
              lazy
            >
              <template #error><div class="row-img-empty">无图</div></template>
            </el-image>
            <div v-else class="row-img-empty">无图</div>

            <div class="row-main">
              <div class="row-title">
                {{ p.title || '未采集标题' }}
                <span v-if="p.comment_count > 0" class="row-note-flag" title="有笔记">📌</span>
              </div>
              <div class="row-comment" v-if="p.my_comment" v-html="p.my_comment"></div>
            </div>

            <div class="row-data">
              <span class="d-appear" title="出现次数">出现 {{ p.appear_count }}</span>
              <span class="d-view" title="浏览次数">浏览 {{ p.view_count }}</span>
            </div>
            <a
              v-if="!batchMode"
              :href="productUrl(p.offer_id)"
              target="_blank"
              class="row-jump"
              title="跳转到 1688 商品详情页"
              @click.stop
            >
              跳转商品<el-icon><TopRight /></el-icon>
            </a>
            <el-icon v-if="!batchMode" class="row-arrow"><ArrowRight /></el-icon>
          </div>
        </div>
      </template>

      <!-- 未选中供应商 -->
      <div v-else class="no-selection">
        <el-empty v-if="!loading" description="请从左侧选择一个供应商" />
      </div>
    </main>

    <!-- 商品详情：右侧滑出 -->
    <el-drawer v-model="drawerVisible" :title="currentProduct?.title || '商品详情'" size="420px">
      <div v-if="currentProduct" v-loading="detailLoading" class="detail">
        <el-image
          v-if="currentProduct.main_img_url"
          :src="currentProduct.main_img_url"
          class="d-img"
          fit="cover"
        />
        <div class="d-supplier">供应商：{{ detail?.supplier_name || '—' }}</div>

        <!-- 核心数据 -->
        <div class="d-data-grid" v-if="detail">
          <div class="d-data-item">
            <div class="d-data-num">{{ detail.totals.appear_count }}</div>
            <div class="d-data-label">出现次数</div>
          </div>
          <div class="d-data-item">
            <div class="d-data-num">{{ detail.totals.view_count }}</div>
            <div class="d-data-label">浏览次数</div>
          </div>
          <div class="d-data-item">
            <div class="d-data-num">{{ detail.totals.comment_count }}</div>
            <div class="d-data-label">笔记条数</div>
          </div>
        </div>
        <div class="d-time-range" v-if="detail && detail.first_viewed_at">
          首次浏览 {{ fmtDateTime(detail.first_viewed_at) }}<br />最近浏览 {{ fmtDateTime(detail.last_viewed_at) }}
        </div>

        <!-- 近 30 天每日数据 -->
        <template v-if="detail && viewedDays.length">
          <h4 class="d-section">近 30 天出现 / 浏览记录</h4>
          <div class="d-day-list">
            <div v-for="d in viewedDays" :key="d.date" class="d-day-row">
              <span class="d-day-date">{{ d.date }}</span>
              <span class="d-day-appear" v-if="d.appear">出现 {{ d.appear }} 次</span>
              <span class="d-day-view" v-if="d.view">浏览 {{ d.view }} 次</span>
            </div>
          </div>
        </template>

        <!-- 每次浏览时间线 -->
        <template v-if="detail && detail.view_times.length">
          <h4 class="d-section">浏览时间线（共 {{ detail.view_times.length }} 次）</h4>
          <div class="d-view-times">
            <span v-for="(t, i) in detail.view_times" :key="i" class="d-view-time">{{ fmtDateTime(t) }}</span>
          </div>
        </template>

        <!-- 商品笔记 -->
        <h4 class="d-section">我的笔记</h4>
        <div v-if="currentProduct.comment_count > 0" class="d-comments">
          <div class="d-comment" v-html="currentProduct.my_comment"></div>
        </div>
        <div v-else class="d-empty">暂无笔记，可在商品详情页编辑</div>

        <el-button
          type="danger"
          plain
          class="d-delete"
          :icon="Delete"
          @click="drawerVisible = false; deleteProduct(currentProduct)"
        >删除该商品及全部数据</el-button>
      </div>
    </el-drawer>

    <!-- 批量浮条 -->
    <div v-if="batchMode" class="batch-bar">
      <span>已选 {{ selectedCount }} 个商品</span>
      <el-button type="danger" size="small" :disabled="selectedCount === 0" @click="batchDelete">删除选中</el-button>
    </div>
  </section>
</template>

<style scoped>
.sources-page {
  display: flex;
  gap: 14px;
  height: calc(100vh - 48px);
  padding-bottom: 0;
}

/* 左栏 */
.supplier-pane {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-search { padding: 10px; border-bottom: 1px solid #f2f3f5; }
.supplier-list { flex: 1; overflow-y: auto; padding: 6px; }
.supplier-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.supplier-item:hover { background: #f7f8fa; }
.supplier-item.on { background: #fdf4ea; }
.s-pin { font-size: 12px; flex-shrink: 0; }
.s-info { min-width: 0; }
.s-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.supplier-item.on .s-name { color: #c9975c; }
.s-meta { font-size: 11px; color: #a8abb2; margin-top: 2px; }
.pane-empty { text-align: center; font-size: 12px; color: #bbb; padding: 30px 0; }

/* 右栏 */
.product-pane {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-head {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f3f5;
}
.head-title { font-size: 16px; font-weight: 600; color: #303133; }
.head-meta { font-size: 12px; font-weight: 400; color: #a8abb2; margin-left: 10px; }
.head-actions { margin-left: auto; display: flex; gap: 8px; }

/* 供应商笔记 */
.supplier-note {
  margin: 12px 16px 0;
  background: #fdf8f3;
  border-left: 3px solid #c9975c;
  border-radius: 0 6px 6px 0;
  padding: 10px 14px;
}
.note-row { display: flex; align-items: flex-start; gap: 12px; }
.note-text { font-size: 13px; color: #5b4a35; line-height: 1.5; flex: 1; }
.note-text :deep(p) { margin: 0 0 4px; }
.note-text :deep(ul), .note-text :deep(ol) { margin: 4px 0; padding-left: 18px; }
.note-time { font-size: 11px; color: #c4b08c; white-space: nowrap; padding-top: 2px; }

/* 商品行 */
.product-rows { flex: 1; overflow-y: auto; padding: 8px 10px; }
.product-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}
.product-row:hover { background: #faf7f3; border-color: #f0e6d8; }
.row-check { flex-shrink: 0; }
.row-img {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  flex-shrink: 0;
  background: #fafafa;
}
.row-img-empty {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 11px;
  flex-shrink: 0;
}
.row-main { flex: 1; min-width: 0; }
.row-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-note-flag { margin-left: 4px; }
.row-comment {
  font-size: 12px;
  color: #909399;
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-comment :deep(p) { display: inline; margin: 0; }
.row-comment :deep(img) { display: none; }
.row-data {
  display: flex;
  gap: 14px;
  flex-shrink: 0;
  font-size: 12px;
}
.d-appear { color: #7d96bd; }
.d-view { color: #c9975c; font-weight: 600; }
.row-jump {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  font-size: 12px;
  color: #c9975c;
  text-decoration: none;
  padding: 4px 8px;
  border: 1px solid #ecdcc7;
  border-radius: 4px;
  background: #fffdfb;
}
.row-jump:hover { background: #fdf4ea; border-color: #c9975c; }
.row-arrow { color: #c0c4cc; flex-shrink: 0; }

.no-selection { flex: 1; display: flex; align-items: center; justify-content: center; }

/* 详情抽屉 */
.d-img { width: 100%; max-height: 240px; border-radius: 8px; }
.d-supplier { font-size: 13px; color: #606266; margin: 12px 0; }
.d-data-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}
.d-data-item {
  background: #faf7f3;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.d-data-num { font-size: 22px; font-weight: 700; color: #c9975c; }
.d-data-label { font-size: 12px; color: #909399; margin-top: 2px; }
.d-time-range { font-size: 12px; color: #909399; margin-bottom: 8px; line-height: 1.8; }
.d-section { font-size: 14px; font-weight: 600; color: #303133; margin: 18px 0 10px; }

.d-day-list { display: flex; flex-direction: column; gap: 6px; }
.d-day-row {
  display: flex;
  gap: 12px;
  font-size: 12px;
  padding: 6px 10px;
  background: #fafafa;
  border-radius: 6px;
}
.d-day-date { color: #606266; font-weight: 600; min-width: 48px; }
.d-day-appear { color: #7d96bd; }
.d-day-view { color: #c9975c; }

.d-view-times { display: flex; flex-wrap: wrap; gap: 6px; }
.d-view-time {
  font-size: 11px;
  color: #8a6d4b;
  background: #fdf8f3;
  border: 1px solid #f0e2cf;
  border-radius: 4px;
  padding: 3px 8px;
}

.d-comments { font-size: 13px; color: #606266; line-height: 1.6; }
.d-comment {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px 14px;
}
.d-comment :deep(p) { margin: 0 0 4px; }
.d-comment :deep(ul), .d-comment :deep(ol) { margin: 4px 0; padding-left: 18px; }
.d-empty { font-size: 13px; color: #bbb; }
.d-delete { margin-top: 24px; width: 100%; }

/* 批量浮条 */
.batch-bar {
  position: fixed;
  bottom: 24px;
  left: calc(50% + 100px);
  transform: translateX(-50%);
  background: #303133;
  color: #fff;
  border-radius: 24px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);
  z-index: 2000;
}
</style>
