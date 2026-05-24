<!-- entrypoints/box/App.vue -->
<script setup>
import { ref } from 'vue'
const props = defineProps(['parentEl'])
const showSupplier = ref(false)
const panelhtml = ref('')
// 直接改父元素样式
if (props.parentEl) {
  props.parentEl.style.height = 'auto'
}
panelhtml.value = props.parentEl.innerText
const href = props.parentEl.getAttribute('href');
const aplus = props.parentEl.getAttribute('data-aplus-report') || '';
const match = aplus.match(/object_member_id@([^&^]+)/);
const memberId = match ? match[1] : null;


const data_renderkey = props.parentEl.getAttribute('data-renderkey') || props.parentEl.getAttribute('data-renderkey');
const data_aplus = props.parentEl.getAttribute('data-aplus-report') || props.parentEl.getAttribute('data-aplus-report');
const link_element = props.parentEl.querySelector('a[href*="offerId="]') || props.parentEl;

const match_href = href?.match(/offerId=(\d+)/)?.[1];
const match_renderkey = data_renderkey?.match(/_(\d+)$/)?.[1];
const match_offerId = data_aplus?.match(/offerId@(\d+)/)?.[1];
const match_objectId = data_aplus?.match(/object_id@(\d+)/)?.[1];
const match_link_href = link_element?.href?.match(/offerId=(\d+)/)?.[1];

const offer_id = match_renderkey || match_href || match_offerId || match_objectId || match_link_href;
const name_element = props.parentEl.querySelector('.offer-shop-row .desc-text');
const name_element1 = props.parentEl.querySelector('[class^="shopName"]');
const name_element2 = props.parentEl.querySelector('.company-name');

const company_name = (name_element1?.textContent?.trim()) || (name_element?.textContent?.trim()) || (name_element2?.textContent?.trim()) || '默认公司名';
// 基于 offer_id 的确定性随机
function seedHash(s) {
  let h = 0
  if (!s) return Math.floor(Math.random() * 99999)
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
const seed = seedHash(offer_id + '_product')

function pick(arr, offset) {
  return arr[(seed + offset) % arr.length]
}

function pickCount(min, max, offset) {
  return min + ((seed + offset) % (max - min + 1))
}

// ── 商品数据 ──
const tagPool = ['亚马逊', '爱路客', '配件', '美国', '金波', '现货', '定制', '批发', '日本', '欧洲', '包邮', '新款', '热销', '套装', '新品']
const tagCount = pickCount(0, 5, 1)
const tags = Array.from({ length: tagCount }, (_, i) => pick(tagPool, i + 10))

const namePool = [
  { name: 'Conley', initial: 'C' },
  { name: '张三', initial: '张' },
  { name: '李四', initial: '李' },
  { name: '王五', initial: '王' },
  { name: 'Alex', initial: 'A' },
  { name: 'Mike', initial: 'M' },
  { name: 'Lisa', initial: 'L' },
  { name: 'Tom', initial: 'T' },
  { name: 'Kate', initial: 'K' },
  { name: 'Jane', initial: 'J' },
  { name: 'Bob', initial: 'B' },
  { name: 'Amy', initial: 'A' },
]
const viewerCount = tagCount > 0 ? pickCount(1, 8, 50) : pickCount(0, 3, 50)
const viewers = Array.from({ length: viewerCount }, (_, i) => ({
  name: pick(namePool, i + 100).name,
  initial: pick(namePool, i + 100).initial,
  count: pickCount(1, 20, i + 200)
}))

const totalViews = viewers.reduce((s, v) => s + v.count, 0)
const messageCount = totalViews > 0 ? pickCount(0, totalViews + 1, 99) : 0

const avatarColors = ['#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']

const commentPool = [
  { text: '这个供应商质量不错，合作过几次！！！问请问我去发生的发第三方 的f！！！', name: 'Conley', initial: 'C' },
  { text: '价格偏高，但交期准时，注意核对！！！！！ 第三方水电费的 4 3 2 的是的是的啊啊a！！！！', name: '张三', initial: '张' },
  { text: '注意尺寸偏差，上次退了100个，是则需要重新购买', name: '李四', initial: '李' },
  { text: '建议先拿样品测试再批量，21312 送达 阿萨德', name: '王五', initial: '王' },
  { text: '包装太简陋容易破损，需加固，脾气为我司阿迪好家伙就会更多更好语法语言 g 火锅 宏观经济 环境', name: 'Alex', initial: 'A' },
  { text: '物流很快3天到货，值得推荐 23123 的方式深 V', name: 'Lisa', initial: 'L' },
  { text: '质量一般不推荐，超级中间商，服务差 ，  问问 萨顶顶哈哈的健康我回去 i 问问 我', name: 'Tom', initial: 'T' },
]
const commentCount = viewerCount > 0 ? pickCount(1, 2, 120) : 0
const comments = ref(Array.from({ length: commentCount }, (_, i) => ({
  ...pick(commentPool, i + 300),
  date: `${pickCount(1, 12, i + 400)}/${pickCount(1, 28, i + 500)}`,
  color: avatarColors[(seed + i + 10) % avatarColors.length]
})))

function copyId(e) {
  e.stopPropagation()
  if (offer_id) {
    navigator.clipboard.writeText(offer_id)
  }
}

fetch(`http://localhost:3000/api/v1/products/${offer_id}`)
  .then(response => response.json())
  .then(data => {
    if (data.data.comments) comments.value = data.data.comments
  })

// ── 供应商数据（用独立种子） ──
const supSeed = seedHash(offer_id + '_supplier')
function supPick(arr, offset) { return arr[(supSeed + offset) % arr.length] }
function supCount(min, max, offset) { return min + ((supSeed + offset) % (max - min + 1)) }

// 供应商评论
const supCommentPool = [
  { text: '合作了3年，质量一直很稳定，值得推荐！！ 回复啊啊 速度快 我去玩 企鹅我去问', name: 'Conley', initial: 'C' },
  { text: '交期偶尔延误，但沟通顺畅，品质不错，的 问问企鹅群我热我个人', name: '张经理', initial: '张' },
  { text: '价格在同行业中有优势，但注意核对包装规格，发发色服务费 飞飞飞', name: '李厂长', initial: '李' },
  { text: '响应速度快，样品当天发出，去看看我纠结 3434 个哈哈', name: '王总', initial: '王' },
  { text: '验厂通过，生产设备先进，已列为合格供应商 发生的飞洒发撒大声地', name: 'Lisa', initial: 'L' },
  { text: '售后处理及时，上次退换货3天解决，飞洒发史蒂芬孙发热', name: 'Tom', initial: 'T' },
  { text: '物流合作顺畅，专线直达，到货破损率低，反反复复发顺丰', name: 'Kate', initial: 'K' },
]
const supCommentCount = supCount(1, 2, 6)
const supComments = Array.from({ length: supCommentCount }, (_, i) => ({
  ...supPick(supCommentPool, i + 100),
  date: `${supCount(1, 12, i + 200)}/${supCount(1, 28, i + 300)}`,
  color: avatarColors[(supSeed + i + 5) % avatarColors.length]
}))

</script>

<template>
  <div class="hs-wrapper" @mouseleave="showSupplier = false">
    <!-- 滑动容器 -->
    <div class="hs-slider" :class="{ 'hs-slider--supplier': showSupplier }">
      <!-- ── 商品信息面板 ── -->
      <div class="hs-panel" @click.stop.prevent>
        <div class="hs-id-row" @click.stop.prevent>
          <span class="hs-id-tag" :class="{ 'hs-id-tag--hot': totalViews > 0 }">ID</span>
          <span class="hs-id-value"
            :class="{ 'hs-id-value--hot': totalViews > 0, 'hs-id-value--cold': totalViews === 0 }" title="点击复制"
            @click="copyId" @click.stop.prevent>{{ offer_id }}</span>
          <span v-if="totalViews > 0" class="hs-views-badge">{{ totalViews }}<i class="hs-eye-icon"></i></span>
          <span v-if="messageCount > 0" class="hs-msg-badge">{{ messageCount }}<i class="hs-msg-icon"></i></span>
        </div>

        <div v-if="comments.length" class="hs-comments">
          <div v-if="comments.length === 1" class="hs-comment hs-comment--single">
            <div class="hs-cmt-avatar" :style="{ background: comments[0].color }">{{ comments[0].initial }}</div>
            <div class="hs-cmt-body--single">
              <span class="hs-cmt-text">{{ comments[0].text }}</span>
              <span class="hs-cmt-date">{{ comments[0].date }}</span>
            </div>
          </div>
          <template v-else>
            <div v-for="(c, i) in comments.slice(0, 2)" :key="i" class="hs-comment">
              <div class="hs-cmt-avatar" :style="{ background: c.color }">{{ c.initial }}</div>
              <div class="hs-cmt-body hs-cmt-body--multi">{{ c.text }}</div>
              <span class="hs-cmt-date">{{ c.date }}</span>
            </div>
          </template>
        </div>
        <div v-else class="hs-note--empty">暂无备注</div>

        <div class="hs-spacer"></div>

        <div v-if="tags.length && totalViews > 0" class="hs-tags">
          <span v-for="(tag, i) in tags" :key="tag" class="hs-tag" :class="{ 'hs-tag--overflow': i >= 4 }">{{ tag
            }}</span>
          <span v-if="tags.length > 4" class="hs-tag-more">+{{ tags.length - 4 }}</span>
        </div>

        <div v-if="viewers.length && totalViews > 0" class="hs-viewers">
          <div class="hs-avatar-stack">
            <div v-for="(v, i) in viewers.slice(0, 5)" :key="i" class="hs-avatar"
              :style="{ background: avatarColors[(seed + i) % avatarColors.length], zIndex: viewers.length - i }"
              :title="`${v.name} · 看过 ${v.count} 次`">{{ v.initial }}</div>
            <span v-if="viewers.length > 5" class="hs-avatar-more">+{{ viewers.length - 5 }}</span>
          </div>
        </div>
      </div>

      <!-- ── 供应商信息面板 ── -->
      <div class="hs-panel hs-panel--supplier" @click.stop.prevent>
        <!-- 供应商名称 -->
        <div class="hs-sup-header">
          <span class="hs-sup-name" :title="company_name">{{ company_name }}</span>
        </div>

        <!-- 供应商评论 -->
        <div v-if="supComments.length" class="hs-comments">
          <template v-if="supComments.length >= 1">
            <div v-for="(c, i) in supComments.slice(0, 2)" :key="i" class="hs-comment">
              <div class="hs-cmt-avatar" :style="{ background: c.color }">{{ c.initial }}</div>
              <div class="hs-cmt-body hs-cmt-body--multi">{{ c.text }}</div>
              <span class="hs-cmt-date">{{ c.date }}</span>
            </div>
          </template>
        </div>
        <div v-else class="hs-note--empty">暂无评价</div>

        <div class="hs-spacer"></div>
      </div>
    </div>

    <!-- 浮动三角图标 -->
    <div class="hs-triangle-toggle" :class="{ 'hs-triangle-toggle--active': showSupplier }"
      @mouseenter="showSupplier = true">
      <span class="hs-triangle-arrow"></span>
    </div>
  </div>
</template>

<style scoped>
/* ── 外层包裹，控制溢出和定位 ── */
.hs-wrapper {
  position: relative;
  overflow: hidden;
  margin: 4px 0 2px;
  height: 120px;
  pointer-events: none;
}

/* ── 左右滑动容器 ── */
.hs-slider {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.hs-slider--supplier {
  transform: translateX(-50%);
}

/* ── 两个面板各占 50% ── */
.hs-panel {
  width: 50%;
  height: 120px;
  padding: 6px 8px;
  background: #f5f6f8;
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
  color: #333;
  font-size: 0;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.hs-panel--supplier {
  padding-left: 4px;
}

/* ── 商品ID - flex 居中 + 自适应截断 ── */
.hs-id-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 3px;
  min-width: 0;
  gap: 0;
}

.hs-id-tag {
  display: inline-flex;
  font-size: 10px;
  color: #fff;
  background: #bbb;
  padding: 0 4px;
  line-height: 16px;
  border-radius: 2px;
  margin-right: 4px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.hs-id-tag--hot {
  background: #2ecc71;
}

.hs-id-value {
  font-size: 12px;
  font-weight: 500;
  font-family: Menlo, Monaco, "Courier New", monospace;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
  cursor: pointer;
  pointer-events: auto;
}

.hs-id-value:active {
  opacity: 0.5;
}

.hs-id-value--cold {
  color: #bbb;
}

.hs-id-value--hot {
  color: #ff6a00;
}

.hs-views-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: #fff;
  background: #2ecc71;
  padding: 0 4px;
  line-height: 16px;
  border-radius: 2px;
  margin-left: 4px;
  flex-shrink: 0;
}

.hs-msg-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: #fff;
  background: #3498db;
  padding: 0 4px;
  line-height: 16px;
  border-radius: 2px;
  margin-left: 4px;
  flex-shrink: 0;
}

.hs-eye-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") center/contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'/%3E%3C/svg%3E") center/contain no-repeat;
  vertical-align: middle;
}

.hs-msg-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z'/%3E%3C/svg%3E") center/contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z'/%3E%3C/svg%3E") center/contain no-repeat;
  vertical-align: middle;
}

/* ── 弹性撑开 ── */
.hs-spacer {
  flex: 1;
  min-height: 2px;
}

/* ── 用户评论 ── */
.hs-comments {
  font-size: 0;
}

.hs-comment {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 1px;
  min-width: 0;
}

.hs-comment:last-child {
  margin-bottom: 0;
}

.hs-cmt-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.hs-cmt-body--multi {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 11px;
  line-height: 1.6;
  color: #555;
}

.hs-cmt-body--single {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.hs-cmt-body--single .hs-cmt-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.6;
  color: #555;
  word-break: break-all;
}

.hs-cmt-body--single .hs-cmt-date {
  position: absolute;
  bottom: 0;
  right: 0;
  font-size: 9px;
  color: #bbb;
  background: #f5f6f8;
  padding-left: 3px;
  white-space: nowrap;
  line-height: 1.6;
}

.hs-cmt-date {
  font-size: 9px;
  color: #bbb;
  flex-shrink: 0;
  line-height: 1.6;
  padding-left: 4px;
  white-space: nowrap;
}

.hs-note--empty {
  color: #ccc;
  font-style: italic;
  font-size: 11px;
}

/* ── 标签 ── */
.hs-tags {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.hs-tag {
  display: inline-block;
  padding: 0 5px;
  font-size: 10px;
  line-height: 18px;
  color: #fff;
  border-radius: 2px;
  background: #999;
}

.hs-tag--overflow {
  display: none;
}

.hs-tag-more {
  display: inline-block;
  font-size: 10px;
  color: #999;
  line-height: 18px;
  padding: 0 2px;
}

.hs-tag:nth-child(6n+1) {
  background: #ff6a00;
}

.hs-tag:nth-child(6n+2) {
  background: #2ecc71;
}

.hs-tag:nth-child(6n+3) {
  background: #3498db;
}

.hs-tag:nth-child(6n+4) {
  background: #9b59b6;
}

.hs-tag:nth-child(6n+5) {
  background: #e74c3c;
}

.hs-tag:nth-child(6n+6) {
  background: #1abc9c;
}

/* ── 用户首字母头像栈 ── */
.hs-viewers {
  margin-bottom: 2px;
}

.hs-avatar-stack {
  display: inline-flex;
  align-items: center;
  flex-direction: row;
}

.hs-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  border: 1.5px solid #f5f6f8;
  flex-shrink: 0;
  cursor: default;
  position: relative;
}

.hs-avatar:not(:first-child) {
  margin-left: -6px;
}

.hs-avatar-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e0e0e0;
  color: #999;
  font-size: 9px;
  font-weight: 500;
  border: 1.5px solid #f5f6f8;
  margin-left: 0;
  flex-shrink: 0;
}

/* ── 供应商头部 ── */
.hs-sup-header {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
  min-width: 0;
}

.hs-sup-name {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* ── 浮动三角图标 ── */
.hs-triangle-toggle {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 14px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  z-index: 10;
  border-radius: 3px 0 0 3px;
  transition: background 0.2s;
}

.hs-triangle-toggle:hover {
  background: rgba(0, 0, 0, 0.06);
}

.hs-triangle-toggle--active {
  background: rgba(0, 0, 0, 0.06);
}

.hs-triangle-arrow {
  display: inline-block;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 7px solid #bbb;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hs-triangle-toggle--active .hs-triangle-arrow {
  border-left-color: #ff6a00;
  transform: rotate(180deg);
}
</style>