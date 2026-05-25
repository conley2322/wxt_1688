<!-- entrypoints/box/App.vue -->
<script setup>
import { ref } from 'vue'
import HsAvatarStack from '../../components/HsAvatarStack.vue'
import HsTagsPanel from '../../components/HsTagsPanel.vue'
import HsCommentList from '../../components/HsCommentList.vue'
const props = defineProps(['parentEl'])
const activePanel = ref(0)
const viewMode = ref('product')
// 直接改父元素样式
if (props.parentEl) {
  props.parentEl.style.height = 'auto'
}
const href = props.parentEl.getAttribute('href');

const data_renderkey = props.parentEl.getAttribute('data-renderkey') || props.parentEl.getAttribute('data-renderkey');
const data_aplus = props.parentEl.getAttribute('data-aplus-report') || props.parentEl.getAttribute('data-aplus-report');
const link_element = props.parentEl.querySelector('a[href*="offerId="]') || props.parentEl;

const match_href = href?.match(/offerId=(\d+)/)?.[1];
const match_renderkey = data_renderkey?.match(/_(\d+)$/)?.[1];
const match_offerId = data_aplus?.match(/offerId@(\d+)/)?.[1];
const match_objectId = data_aplus?.match(/object_id@(\d+)/)?.[1];
const match_link_href = link_element?.href?.match(/offerId=(\d+)/)?.[1];

const offer_id = match_renderkey || match_href || match_offerId || match_objectId || match_link_href;
console.log('商品 id:', offer_id);

// ── 确定性随机函数 ──
function seedHash(s) {
  let h = 0
  if (!s) return Math.floor(Math.random() * 99999)
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}
const _seed = seedHash(offer_id + '_mock')
function _pick(arr, o) { return arr[(_seed + o) % arr.length] }
function _cnt(min, max, o) { return min + ((_seed + o) % (max - min + 1)) }

// ── 随机生成虚拟概要数据 ──
const namePool = [
  { name: 'Conley', initial: 'C' }, { name: '张三', initial: '张' }, { name: '李四', initial: '李' },
  { name: '王五', initial: '王' }, { name: 'Alex', initial: 'A' }, { name: 'Lisa', initial: 'L' },
  { name: 'Tom', initial: 'T' }, { name: 'Kate', initial: 'K' }, { name: 'Jane', initial: 'J' },
  { name: 'Bob', initial: 'B' }, { name: 'Amy', initial: 'A' }, { name: 'Mike', initial: 'M' }
]
const tagPool = ['质量问题', '可深度合作', '交期长', '已测样品', '价格偏高', '响应快', '包装破损', '物流快', '退货率高', '支持定制']
const avatarColors = ['#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']

const viewerCount = _cnt(0, 8, 1)
const viewers = Array.from({ length: viewerCount }, (_, i) => ({
  ..._pick(namePool, i + 10),
  count: _cnt(1, 20, i + 100)
}))

const tagCount = _cnt(0, 6, 50)
const tags = Array.from({ length: tagCount }, (_, i) => ({
  text: _pick(tagPool, i + 200),
  user_name: _pick(namePool, i + 300).name,
  date: `2026-${String(_cnt(1, 5, i + 400)).padStart(2, '0')}-${String(_cnt(1, 28, i + 500)).padStart(2, '0')}`
}))

const summaryData = {
  offer_id,
  view_count: viewers.reduce((s, v) => s + v.count, 0),
  tag_count: tagCount,
  comment_count: _cnt(0, 5, 99),
  viewers,
  tags
}

// ── 随机生成虚拟评论数据 ──
const commentPool = [
  { text: '这个供应商还行', user_name: 'Conley', initial: 'C' },
  { text: '价格偏高，但交期准时，注意核对包装规格', user_name: '张三', initial: '张' },
  { text: '注意尺寸偏差，上次打算大师的 a退了100个，建议先拿样品测试再批量', user_name: '李四', initial: '李' },
  { text: '包装太简陋容易破损，啊实打实的按时的sa需加固，不然运输中容易损坏产品', user_name: 'Alex', initial: 'A' },
  { text: '物流很快3天到货， 222 撒大按时打算阿迪按时这个供应商值得长期合作推荐', user_name: 'Lisa', initial: 'L' },
  { text: '质量一般  差', user_name: 'Tom', initial: 'T' },
  { text: '样品已收到，品质a 是的 撒大番茄味亲亲我额符合阿萨德撒大要求，准备下大货了', user_name: 'Kate', initial: 'K' },
  { text: '这个工厂我去验过，设备先进管理规范，靠谱', user_name: '王五', initial: '王' },
  { text: '价格在同行业 奥德赛打算打算中有优势，但最小起订量太高了，要5000起', user_name: 'Bob', initial: 'B' },
  { text: '交期延误了3天， 撒大撒大是的撒发 说是原材料问题，但沟通态度还好', user_name: 'Jane', initial: 'J' },
]
const commentCount = _cnt(0, 8, 80)
const detailData = {
  offer_id,
  comments: Array.from({ length: commentCount }, (_, i) => ({
    ..._pick(commentPool, i + 1000),
    date: `20${_cnt(24, 26, i + 1100)}-${String(_cnt(1, 5, i + 1200)).padStart(2, '0')}-${String(_cnt(1, 28, i + 1300)).padStart(2, '0')}`,
    color: _pick(avatarColors, i + 1400)
  }))
}

// ── 随机生成虚拟供应商数据 ──
const supTagPool = ['已合作', '优质供应商', '交期稳定', '通过验厂', '支持定制', '有现货', '可退换', '金牌供应商', '响应快', '价格合理']
const supTagCount = _cnt(0, 6, 5000)
const supTags = Array.from({ length: supTagCount }, (_, i) => ({
  text: _pick(supTagPool, i + 6000),
  user_name: _pick(namePool, i + 7000).name,
  date: `2026-${String(_cnt(1, 5, i + 8000)).padStart(2, '0')}-${String(_cnt(1, 28, i + 9000)).padStart(2, '0')}`
}))
const supCommentPool = [
  { text: '合作了3年质量稳定，值得长期合作', user_name: 'Conley', initial: 'C' },
  { text: '交期偶尔延误但沟通顺畅', user_name: '张三', initial: '张' },
  { text: '价格有优势但注意核对包装规格', user_name: '李四', initial: '李' },
  { text: '验厂通过设备先进，已列为合格供应商', user_name: 'Lisa', initial: 'L' },
  { text: '售后处理及时，退换货3天解决', user_name: 'Tom', initial: 'T' },
  { text: '物流专线直达破损率低', user_name: 'Kate', initial: 'K' },
]
const supCommentCount = _cnt(0, 8, 10000)
const coopUserCount = _cnt(1, 4, 30000)
const coopUsers = Array.from({ length: coopUserCount }, (_, i) => ({
  ..._pick(namePool, i + 31000),
  first_date: `2026-${String(_cnt(1, 5, 32000 + i)).padStart(2, '0')}-${String(_cnt(1, 28, 33000 + i)).padStart(2, '0')}`
}))

const supplierData = {
  offer_id,
  tag_count: supTagCount,
  comment_count: supCommentCount,
  viewers: coopUsers,
  tags: supTags,
  comments: Array.from({ length: supCommentCount }, (_, i) => ({
    ..._pick(supCommentPool, i + 11000),
    date: `20${_cnt(24, 26, i + 12000)}-${String(_cnt(1, 5, i + 13000)).padStart(2, '0')}-${String(_cnt(1, 28, i + 14000)).padStart(2, '0')}`,
    color: _pick(avatarColors, i + 15000)
  }))
}

// ── 组件数据映射（预格式化） ──
const productTagData = summaryData.tags.map(t => ({ text: t.text, tooltip: `${t.user_name} · ${formatDate(t.date)}` }))
const supTagData = supplierData.tags.map(t => ({ text: t.text, tooltip: `${t.user_name} · ${formatDate(t.date)}` }))
const productViewerData = summaryData.viewers.map(v => ({ initial: v.initial, tooltip: `${v.name} · ${v.count}次` }))
const supViewerData = supplierData.viewers.map(v => ({ initial: v.initial, tooltip: `${v.name} · ${formatDate(v.first_date)}` }))

// ── 响应式状态 ──
const commentsLoaded = ref(false)
const comments = ref([])
const supCommentsLoaded = ref(false)
const supComments = ref([])

// ── 工具函数：日期格式化 ──
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const currentYear = new Date().getFullYear()
  if (parseInt(y) === currentYear) return `${parseInt(m)}/${parseInt(d)}`
  return `${y.slice(2)}/${parseInt(m)}/${parseInt(d)}`
}

// ── 按需加载评论 ──
function loadComments() {
  if (commentsLoaded.value) return
  commentsLoaded.value = true
  setTimeout(() => {
    comments.value = detailData.comments.map(c => ({
      ...c,
      date: formatDate(c.date),
      tooltip: `${c.user_name}：${c.text}`
    }))
  }, 100)
}

// ── 按需加载供应商评论 ──
function loadSupComments() {
  if (supCommentsLoaded.value) return
  supCommentsLoaded.value = true
  setTimeout(() => {
    supComments.value = supplierData.comments.map(c => ({
      ...c,
      date: formatDate(c.date),
      tooltip: `${c.user_name}：${c.text}`
    }))
  }, 100)
}

function toggleView() {
  const isProduct = viewMode.value === 'product'
  viewMode.value = isProduct ? 'supplier' : 'product'
  activePanel.value = isProduct ? 2 : 0
}
</script>

<template>
  <div class="hs-wrapper" @mouseleave="activePanel = viewMode === 'supplier' ? 2 : 0">
    <!-- 固定顶部行 -->
    <div class="hs-top-row" @click.stop.prevent>
      <div class="hs-icon-group">
        <!-- 标签图标 -->
        <span class="hs-icon-btn" :class="{ 'hs-icon-btn--active': activePanel === 0 || activePanel === 2 }"
          @mouseenter="activePanel = viewMode === 'product' ? 0 : 2" title="标签">
          <i class="hs-icon-tag"></i>
          <span class="hs-icon-count">{{ viewMode === 'product' ? summaryData.tag_count : supplierData.tag_count
            }}</span>
        </span>
        <!-- 评论图标 -->
        <span class="hs-icon-btn" :class="{ 'hs-icon-btn--active': activePanel === 1 || activePanel === 3 }"
          @mouseenter="activePanel = viewMode === 'product' ? 1 : 3; viewMode === 'product' ? loadComments() : loadSupComments()"
          title="评论">
          <i class="hs-icon-comment"></i>
          <span class="hs-icon-count">{{ viewMode === 'product' ? summaryData.comment_count : supplierData.comment_count
            }}</span>
        </span>
        <!-- 浏览图标（纯显示，无交互，仅商品模式） -->
        <span v-if="viewMode === 'product'" class="hs-icon-btn hs-icon-btn--static">
          <i class="hs-icon-eye"></i>
          <span class="hs-icon-count">{{ summaryData.view_count }}</span>
        </span>
      </div>

      <!-- 头像栈 -->
      <HsAvatarStack v-if="viewMode === 'product'" :viewers="productViewerData" :maxShow="3" variant="product" />
      <HsAvatarStack v-else :viewers="supViewerData" :maxShow="3" variant="supplier" />
    </div>

    <!-- 滑动内容区 -->
    <div class="hs-slider-wrap">
      <div class="hs-slider" :class="`hs-slider--p${activePanel}`">
        <!-- 面板0：商品标签 -->
        <div class="hs-panel">
          <HsTagsPanel :tags="productTagData" empty-text="暂无标签" />
          <div class="hs-spacer"></div>
        </div>

        <!-- 面板1：商品评论 -->
        <div class="hs-panel">
          <HsCommentList :comments="comments" empty-text="暂无评论" />
        </div>

        <!-- 面板2：供应商标签 -->
        <div class="hs-panel">
          <HsTagsPanel :tags="supTagData" empty-text="暂无标签" />
          <div class="hs-spacer"></div>
        </div>

        <!-- 面板3：供应商评论 -->
        <div class="hs-panel">
          <HsCommentList :comments="supComments" empty-text="暂无评论" />
        </div>
      </div>
    </div>

    <!-- 右下角浮动切换图标 -->
    <div class="hs-view-toggle" @click.stop.prevent="toggleView" :title="viewMode === 'product' ? '查看供应商信息' : '查看商品信息'">
      <i class="hs-toggle-icon" :class="{ 'hs-toggle-icon--supplier': viewMode === 'supplier' }"></i>
    </div>
  </div>
</template>

<style scoped>
/* ── 外层包裹 ── */
.hs-wrapper {
  position: relative;
  overflow: hidden;
  margin: 4px 0 2px;
  height: 120px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  background: #f5f6f8;
  border-radius: 4px;
}

/* ── 顶部固定行 ── */
.hs-top-row {
  display: flex;
  align-items: center;
  padding: 4px 8px 0;
  flex-shrink: 0;
  pointer-events: auto;
  min-width: 0;
}

/* ── 图标按钮组 ── */
.hs-icon-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.hs-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  line-height: 16px;
  border-radius: 3px;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.15s;
}

.hs-icon-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.hs-icon-btn--active {
  background: rgba(0, 0, 0, 0.08);
}

.hs-icon-btn i {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #888;
  flex-shrink: 0;
}

.hs-icon-btn--active i {
  background: #ff6a00;
}

.hs-icon-count {
  font-size: 10px;
  color: #888;
  line-height: 1;
}

.hs-icon-btn--active .hs-icon-count {
  color: #ff6a00;
  font-weight: 600;
}

.hs-icon-btn--static {
  cursor: default;
  pointer-events: none;
}

/* ── 头像栈 ── */
/* 评论图标 SVG */
.hs-icon-comment {
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z'/%3E%3C/svg%3E") center/contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z'/%3E%3C/svg%3E") center/contain no-repeat;
}

/* 标签图标 SVG */
.hs-icon-tag {
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z'/%3E%3C/svg%3E") center/contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z'/%3E%3C/svg%3E") center/contain no-repeat;
}

/* 浏览图标 SVG */
.hs-icon-eye {
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") center/contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") center/contain no-repeat;
}

/* ── 滑动容器 ── */
.hs-slider-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
  pointer-events: auto;
}

.hs-slider {
  display: flex;
  width: 400%;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.hs-slider--p0 {
  transform: translateX(0);
}

.hs-slider--p1 {
  transform: translateX(-25%);
}

.hs-slider--p2 {
  transform: translateX(-50%);
}

.hs-slider--p3 {
  transform: translateX(-75%);
}

/* ── 面板通用 ── */
.hs-panel {
  width: 25%;
  height: 100%;
  padding: 4px 8px 6px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
  color: #333;
  font-size: 0;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── 弹性撑开 ── */
.hs-spacer {
  flex: 1;
  min-height: 2px;
}

/* ── 右下角浮动切换图标 ── */
.hs-view-toggle {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  z-index: 10;
  transition: background 0.2s;
}

.hs-view-toggle:hover {
  background: #ccc;
}

.hs-toggle-icon {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #888;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z'/%3E%3C/svg%3E") center/contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z'/%3E%3C/svg%3E") center/contain no-repeat;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hs-toggle-icon--supplier {
  background: #ff6a00;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M22 21V5l-5-2-5 2v2H2v14h20zM7 19H4v-2h3v2zm0-4H4v-2h3v2zm0-4H4V9h3v2zm4 8h-3v-2h3v2zm0-4h-3v-2h3v2zm0-4h-3V9h3v2zm10 8h-8v-2h3v-2h-3v-2h3v-2h-3V8h8v11z'/%3E%3C/svg%3E") center/contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M22 21V5l-5-2-5 2v2H2v14h20zM7 19H4v-2h3v2zm0-4H4v-2h3v2zm0-4H4V9h3v2zm4 8h-3v-2h3v2zm0-4h-3v-2h3v2zm0-4h-3V9h3v2zm10 8h-8v-2h3v-2h-3v-2h3v-2h-3V8h8v11z'/%3E%3C/svg%3E") center/contain no-repeat;
}
</style>