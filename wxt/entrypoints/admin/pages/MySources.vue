<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, Plus, Minus } from '@element-plus/icons-vue'
import { api } from '../utils/useApi.js'

const groups = ref([])
const stats = ref({ total_suppliers: 0, suppliers_with_notes: 0, total_products: 0, products_with_notes: 0, total_views: 0, total_appears: 0 })
const loading = ref(false)
const searchText = ref('')
// 笔记筛选：''=全部 / 'notes'=仅有笔记
const noteFilter = ref('')

// ── 手风琴展开状态（有笔记的组默认展开）──
const expandedSet = ref(new Set())
// 每组默认只显示前 8 个产品，超出后点「显示全部」
const showAllSet = ref(new Set())

// ── 批量管理 ──
const batchMode = ref(false)
const selectedSet = ref(new Set()) // key: 's:供应商名' | 'p:offer_id'

// ── 商品详情抽屉 ──
const drawerVisible = ref(false)
const current = ref(null)
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
      // 默认展开有笔记的组（保留用户已手动折叠的选择：刷新才重置）
      const next = new Set(expandedSet.value)
      for (const g of res.data) {
        if (g.comment_count > 0 || g.products.some(p => p.comment_count > 0)) next.add(g.supplier_name)
      }
      expandedSet.value = next
    }
  } catch (e) {
    console.error('[MySources] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

// 搜索防抖
let searchTimer = null
watch(searchText, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 300)
})

// 筛选后的分组（笔记筛选在前端完成）
const visibleGroups = computed(() => {
  if (noteFilter.value !== 'notes') return groups.value
  return groups.value.filter(g => g.comment_count > 0 || g.products.some(p => p.comment_count > 0))
})

function isExpanded(name) {
  return expandedSet.value.has(name)
}
function toggleExpand(name) {
  const next = new Set(expandedSet.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  expandedSet.value = next
}
function visibleProducts(g) {
  return showAllSet.value.has(g.supplier_name) ? g.products : g.products.slice(0, 8)
}
function toggleShowAll(name) {
  const next = new Set(showAllSet.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  showAllSet.value = next
}
const groupHasNotes = g => g.comment_count > 0 || g.products.some(p => p.comment_count > 0)

// ── 批量选择 ──
function isSelected(key) {
  return selectedSet.value.has(key)
}
function toggleSelect(key) {
  const next = new Set(selectedSet.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedSet.value = next
}
// 整组勾选 = 供应商 + 组内全部产品
function toggleGroupSelect(g) {
  const next = new Set(selectedSet.value)
  const keys = [`s:${g.supplier_name}`, ...g.products.map(p => `p:${p.offer_id}`)]
  const allOn = keys.every(k => next.has(k))
  for (const k of keys) {
    if (allOn) next.delete(k)
    else next.add(k)
  }
  selectedSet.value = next
}
function enterBatch() { batchMode.value = true }
function exitBatch() {
  batchMode.value = false
  selectedSet.value = new Set()
}
const selectedCount = computed(() => selectedSet.value.size)

async function batchDelete() {
  const supplierNames = []
  const productIds = []
  for (const k of selectedSet.value) {
    if (k.startsWith('s:')) supplierNames.push(k.slice(2))
    else productIds.push(k.slice(2))
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${supplierNames.length} 个供应商、${productIds.length} 个商品？关联的浏览记录、出现记录和笔记将全部删除，不可恢复。`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '全部删除', cancelButtonText: '取消' }
    )
  } catch { return }
  // 先删供应商（名下产品连带删除），再批量删其余商品
  for (const name of supplierNames) {
    await api(`/api/v1/suppliers/${encodeURIComponent(name)}`, 'DELETE')
  }
  if (productIds.length) {
    await api('/api/v1/products/batch-delete', 'POST', { offer_ids: productIds })
  }
  ElMessage.success('删除完成')
  exitBatch()
  load()
}

// ── 单个删除 ──
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
  load()
}

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

// ── 商品详情抽屉 ──
async function openDrawer(p) {
  if (batchMode.value) return
  current.value = p
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

// ── 时间格式化 ──
function pad(n) { return String(n).padStart(2, '0') }
function fmtDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// 近 30 天每日浏览（取 daily 中有记录的天，降序）
const viewedDays = computed(() => {
  if (!detail.value?.daily) return []
  return detail.value.daily.filter(x => x.view > 0 || x.appear > 0).reverse()
})
</script>

<template>
  <section class="sources-page">
    <div class="page-head">
      <h2 class="page-title">我的货源</h2>
      <div class="head-tools">
        <el-input
          v-model="searchText"
          placeholder="搜索供应商或商品"
          clearable
          style="width:240px"
          :prefix-icon="Search"
        />
        <el-radio-group v-model="noteFilter" size="small">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="notes">仅有笔记</el-radio-button>
        </el-radio-group>
        <el-button v-if="!batchMode" size="default" @click="enterBatch">批量管理</el-button>
        <template v-else>
          <el-button size="default" @click="exitBatch">退出批量</el-button>
        </template>
      </div>
    </div>

    <!-- 概览条 -->
    <div class="stat-strip">
      <span><b>{{ stats.total_suppliers }}</b> 个供应商</span>
      <span><b>{{ stats.suppliers_with_notes }}</b> 个有笔记</span>
      <span><b>{{ stats.total_products }}</b> 件商品</span>
      <span><b>{{ stats.products_with_notes }}</b> 件有笔记</span>
      <span>累计出现 <b>{{ stats.total_appears }}</b> 次</span>
      <span>累计浏览 <b>{{ stats.total_views }}</b> 次</span>
    </div>

    <!-- 分组列表 -->
    <div v-loading="loading" class="group-list">
      <template v-if="visibleGroups.length > 0">
        <div v-for="g in visibleGroups" :key="g.supplier_name" class="group">
          <!-- 供应商头 -->
          <div class="group-head" :class="{ expanded: isExpanded(g.supplier_name) }">
            <el-checkbox
              v-if="batchMode"
              :model-value="[`s:${g.supplier_name}`, ...g.products.map(p => `p:${p.offer_id}`)].every(isSelected)"
              class="group-check"
              @change="toggleGroupSelect(g)"
              @click.stop
            />
            <span class="caret" @click="toggleExpand(g.supplier_name)">
              <el-icon><Minus v-if="isExpanded(g.supplier_name)" /><Plus v-else /></el-icon>
            </span>
            <span class="pin" v-if="groupHasNotes(g)">📌</span>
            <span class="g-name" @click="toggleExpand(g.supplier_name)">{{ g.supplier_name }}</span>
            <span class="g-meta">
              {{ g.product_count }} 件商品
              <template v-if="g.comment_count > 0">· {{ g.comment_count }} 条供应商笔记</template>
            </span>
            <span class="g-actions">
              <el-icon class="g-del" title="删除供应商" @click.stop="deleteSupplier(g)"><Delete /></el-icon>
            </span>
          </div>

          <!-- 展开内容 -->
          <div v-if="isExpanded(g.supplier_name)" class="group-body">
            <!-- 供应商笔记 -->
            <div v-if="g.supplier_comments.length" class="sup-note">
              <div v-for="c in g.supplier_comments" :key="c.id" class="sup-note-item">
                <div class="sup-note-text" v-html="c.text"></div>
                <span class="sup-note-time">{{ fmtDateTime(new Date(c.updated_at || c.created_at).getTime()) }}</span>
              </div>
            </div>

            <!-- 产品网格 -->
            <div class="product-grid">
              <div
                v-for="p in visibleProducts(g)"
                :key="p.offer_id"
                class="product-card"
                :class="{ noted: p.comment_count > 0 }"
                @click="openDrawer(p)"
              >
                <el-checkbox
                  v-if="batchMode"
                  :model-value="isSelected(`p:${p.offer_id}`)"
                  class="p-check"
                  @change="toggleSelect(`p:${p.offer_id}`)"
                  @click.stop
                />
                <span v-if="p.comment_count > 0" class="p-pin">📌</span>
                <el-image
                  v-if="p.main_img_url"
                  :src="p.main_img_url"
                  class="p-img"
                  fit="cover"
                  lazy
                >
                  <template #error><div class="p-img-empty">无图</div></template>
                </el-image>
                <div v-else class="p-img-empty">无图</div>
                <div class="p-title">{{ p.title || '未采集标题' }}</div>
                <div class="p-data">
                  <span class="p-views" title="浏览次数">👁 {{ p.view_count }}</span>
                  <span class="p-appears" title="出现次数">🔄 {{ p.appear_count }}</span>
                  <el-icon v-if="!batchMode" class="p-del" title="删除商品" @click.stop="deleteProduct(p)"><Delete /></el-icon>
                </div>
              </div>
            </div>

            <div v-if="g.products.length > 8" class="show-more" @click="toggleShowAll(g.supplier_name)">
              {{ showAllSet.has(g.supplier_name) ? '收起' : `显示全部 ${g.products.length} 件商品` }}
            </div>
          </div>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="暂无货源数据，去 1688 浏览商品吧" />
    </div>

    <!-- 商品详情抽屉 -->
    <el-drawer v-model="drawerVisible" :title="current?.title || '商品详情'" size="440px">
      <div v-if="current" v-loading="detailLoading" class="detail">
        <el-image
          v-if="current.main_img_url"
          :src="current.main_img_url"
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
          首次浏览 {{ fmtDateTime(detail.first_viewed_at) }} · 最近浏览 {{ fmtDateTime(detail.last_viewed_at) }}
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
        <div v-if="current.comment_count > 0" class="d-comments">
          <div class="d-comment" v-html="current.my_comment"></div>
        </div>
        <div v-else class="d-empty">暂无笔记，可在商品详情页编辑</div>

        <el-button
          type="danger"
          plain
          class="d-delete"
          :icon="Delete"
          @click="drawerVisible = false; deleteProduct(current)"
        >删除该商品及全部数据</el-button>
      </div>
    </el-drawer>

    <!-- 批量操作浮条 -->
    <div v-if="batchMode" class="batch-bar">
      <span>已选 {{ selectedCount }} 项</span>
      <el-button type="danger" size="small" :disabled="selectedCount === 0" @click="batchDelete">删除选中</el-button>
    </div>
  </section>
</template>

<style scoped>
.sources-page { padding-bottom: 60px; }

.page-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0; }
.head-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 概览条 */
.stat-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 14px;
  font-size: 12px;
  color: #909399;
}
.stat-strip b { color: #c9975c; font-size: 14px; font-weight: 700; }

/* 分组 */
.group {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  user-select: none;
}
.group-check { margin-right: 2px; }
.caret {
  display: inline-flex;
  color: #b0b7c3;
  cursor: pointer;
}
.g-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  cursor: pointer;
}
.g-meta { font-size: 12px; color: #a8abb2; }
.g-actions { margin-left: auto; display: flex; gap: 10px; }
.g-del { color: #c0c4cc; cursor: pointer; }
.g-del:hover { color: #f56c6c; }

.group-body { padding: 0 12px 12px; }

/* 供应商笔记 */
.sup-note {
  background: #fdf8f3;
  border-left: 3px solid #c9975c;
  border-radius: 0 6px 6px 0;
  padding: 8px 12px;
  margin-bottom: 12px;
}
.sup-note-item { display: flex; align-items: flex-start; gap: 10px; }
.sup-note-text { font-size: 13px; color: #5b4a35; line-height: 1.5; flex: 1; }
.sup-note-text :deep(p) { margin: 0 0 4px; }
.sup-note-text :deep(ul), .sup-note-text :deep(ol) { margin: 4px 0; padding-left: 18px; }
.sup-note-time { font-size: 11px; color: #c4b08c; white-space: nowrap; padding-top: 2px; }

/* 产品网格 */
.product-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 10px;
}
.product-card {
  position: relative;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow .15s, border-color .15s;
  background: #fff;
}
.product-card:hover { border-color: #c9975c; box-shadow: 0 2px 8px rgba(201,151,92,.12); }
.product-card.noted { border-color: #e8d5b8; }
.p-check {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 2;
}
.p-pin {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 11px;
  z-index: 2;
}
.p-img { width: 100%; aspect-ratio: 1; display: block; background: #fafafa; }
.p-img-empty {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 12px;
  background: #fafafa;
}
.p-title {
  font-size: 12px;
  color: #303133;
  line-height: 1.35;
  padding: 5px 6px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 32px;
}
.p-data {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 6px;
  font-size: 11px;
}
.p-views { color: #c9975c; }
.p-appears { color: #9ca3af; }
.p-del { margin-left: auto; color: #c0c4cc; }
.p-del:hover { color: #f56c6c; }

.show-more {
  text-align: center;
  font-size: 12px;
  color: #c9975c;
  padding: 10px 0 2px;
  cursor: pointer;
}
.show-more:hover { text-decoration: underline; }

/* 抽屉 */
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
.d-time-range { font-size: 12px; color: #909399; margin-bottom: 8px; }
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
  left: 50%;
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
