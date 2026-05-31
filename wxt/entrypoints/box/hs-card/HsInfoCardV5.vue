<template>
  <div class="hs-card" :style="{ width: width === 'auto' ? 'auto' : width + 'px', height: height + 'px' }">
    <div v-if="emptyMode || !activeData" class="hs-empty">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
        <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span>暂无数据</span>
    </div>

    <template v-else>
      <!-- 顶栏 -->
      <div class="hs-bar" @click.stop.prevent>
        <div class="hs-pills" @click.stop.prevent="toggleView">
          <span class="hs-p" :class="{ on: viewMode === 'product' }">商品</span>
        <span class="hs-p" :class="{ on: viewMode === 'factory', 'hs-p--loading': viewMode !== 'factory' && !viewLoaded.factory }">工厂</span>
        </div>
        <div class="hs-nums">
          <span class="hs-n" :class="{ on: expanded === 'tags' }" @click.stop.prevent="expandPanel('tags')">
            <b>{{ tagCount }}</b><i>标签</i>
          </span>
          <span class="hs-n" :class="{ on: expanded === 'comments' }" @click.stop.prevent="expandPanel('comments')">
            <b>{{ commentCount }}</b><i>评论</i>
          </span>
        </div>
        <HsAvatarStack v-if="activeData.viewers && activeData.viewers.length" :viewers="avatarData" :maxShow="5"
          :variant="viewMode === 'factory' ? 'supplier' : 'product'" />
      </div>

      <!-- 内容区：带动画切换 -->
      <div class="hs-body-wrap" @click.stop.prevent>
        <Transition :name="slideDir">
          <div :key="viewMode + (expanded || '')" class="hs-body" :class="{ 'hs-personal': !expanded }">
            <!-- 展开标签 -->
            <template v-if="expanded === 'tags'">
              <div v-if="!isTagsLoaded" class="hs-loading">
                <span class="hs-loading-dots"><i></i><i></i><i></i></span>
              </div>
              <HsTagsPanel v-else :tags="expandedTags" empty-text="暂无标签" />
            </template>
            <!-- 展开评论 -->
            <template v-else-if="expanded === 'comments'">
              <div v-if="!isCommentsLoaded" class="hs-loading">
                <span class="hs-loading-dots"><i></i><i></i><i></i></span>
              </div>
              <HsCommentList v-else :comments="expandedComments" empty-text="暂无评论" />
            </template>
            <!-- 默认个人视角 -->
            <template v-else>
              <!-- 主视图数据加载中 -->
              <div v-if="isViewLoading" class="hs-loading">
                <span class="hs-loading-dots"><i></i><i></i><i></i></span>
              </div>
              <template v-else>
                <div class="hs-note" v-if="activeData.myComment">
                  <div class="hs-note-text">{{ activeData.myComment.text }}</div>
                  <div class="hs-note-meta">{{ activeData.myComment.date }}</div>
                </div>
                <div class="hs-note hs-note--empty" v-else>
                  <div class="hs-note-text hs-note-text--empty">写下你的看法…</div>
                </div>
                <div class="hs-bottom">
                  <div class="hs-my-tags" v-if="activeData.myTags && activeData.myTags.length">
                    <span v-for="(tag, i) in activeData.myTags" :key="i" class="hs-my-tag"
                      :title="tag.date ? '添加于 ' + tag.date : ''">{{ tag.text }}</span>
                  </div>
                  <div class="hs-my-tags hs-my-tags--empty" v-else>暂无标签</div>
                  <span v-if="data.viewCount && viewMode === 'product'" class="hs-view-count" title="浏览量">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <b>{{ data.viewCount }}</b>
                  </span>
                </div>
              </template>
            </template>
          </div>
        </Transition>
      </div>
    </template>
  </div>
</template>

<script setup>
/**
 * HsInfoCardV5 - 信息卡片组件
 *
 * 支持「商品/工厂」双视图切换的信息卡片，内置标签面板、评论列表、头像堆叠。
 * 商品视图和工厂视图各自独立持有 myComment / myTags / tags / comments / viewers 数据。
 * 切换视图和展开标签/评论面板时均采用懒加载策略，通过 load 事件通知父组件拉取数据。
 *
 * ============================================================
 *  Props
 * ============================================================
 * @prop {Number}    width        卡片宽度（px），默认 240
 * @prop {Number}    height       卡片高度（px），默认 160
 * @prop {Boolean}   emptyMode    是否展示空数据占位，默认 false
 * @prop {Object}    data         卡片核心数据，完整结构见下方 JSON 示例
 * @prop {Function}  loadTags     懒加载标签数据：async ({ viewMode }) => { tags, myTags, tagCount? }
 *                                未提供时直接展示 data 中的标签（不显示 loading）
 * @prop {Function}  loadComments 懒加载评论数据：async ({ viewMode }) => { comments, myComment, commentCount? }
 *                                未提供时直接展示 data 中的评论（不显示 loading）
 * @prop {Function}  loadFactory  懒加载工厂数据：async () => factoryData
 *                                未提供时直接展示 data.factory（不显示 loading）
 *
 * ============================================================
 *  data prop 完整 JSON 示例
 * ============================================================
 * {
 *   "viewCount": 1280,
 *   "product": {
 *     "myComment": {
 *       "text": "这个产品整体质量不错，性价比高",
 *       "date": "2024-03-15"
 *     },
 *     "myTags": [
 *       { "text": "已收藏", "date": "2024-03-10" },
 *       { "text": "重点关注", "date": "2024-03-12" }
 *     ],
 *     "tags": [
 *       { "text": "热销", "author": "张三", "date": "2024-03-01" },
 *       { "text": "新品", "author": "李四", "date": "2024-03-05" }
 *     ],
 *     "comments": [
 *       {
 *         "text": "用过之后感觉很好",
 *         "author": "王五",
 *         "date": "2024-03-08",
 *         "color": "#3498db"
 *       },
 *       {
 *         "text": "推荐购买",
 *         "author": "赵六",
 *         "date": "2024-03-10",
 *         "color": "#2ecc71"
 *       }
 *     ],
 *     "viewers": [
 *       { "name": "张三", "tip": "张三 - 产品经理" },
 *       { "name": "李四", "tip": "李四 - 设计师" }
 *     ],
 *     "tagCount": 4,
 *     "commentCount": 3
 *   },
 *   "factory": {
 *     "myComment": {
 *       "text": "工厂产能稳定，交期准时",
 *       "date": "2024-03-14"
 *     },
 *     "myTags": [
 *       { "text": "优质供应商", "date": "2024-03-11" }
 *     ],
 *     "tags": [
 *       { "text": "认证工厂", "author": "系统", "date": "2024-02-20" }
 *     ],
 *     "comments": [
 *       {
 *         "text": "合作多年，品质可靠",
 *         "author": "钱七",
 *         "date": "2024-03-01",
 *         "color": "#9b59b6"
 *       }
 *     ],
 *     "viewers": [
 *       { "name": "孙八", "tip": "孙八 - 采购主管" }
 *     ],
 *     "tagCount": 2,
 *     "commentCount": 2
 *   }
 * }
 *
 * ============================================================
 *  外部调用示例
 * ============================================================
 * &lt;template&gt;
 *   &lt;HsInfoCardV5
 *     :width="280"
 *     :height="180"
 *     :data="cardData"
 *     :load-tags="fetchTags"
 *     :load-comments="fetchComments"
 *     :load-factory="fetchFactory"
 *   /&gt;
 * &lt;/template&gt;
 *
 * &lt;script setup&gt;
 * import { ref } from 'vue'
 * import HsInfoCardV5 from '@/components/hs-card/HsInfoCardV5.vue'
 *
 * const cardData = ref({ ... })  // 参考上方 JSON 示例，提供初始静态数据
 *
 * // 返回的数据会被合并进对应 viewMode 的数据层
 * async function fetchTags({ viewMode }) {
 *   const res = await api.getTags(viewMode)
 *   return { tags: res.tags, myTags: res.myTags, tagCount: res.total }
 * }
 *
 * async function fetchComments({ viewMode }) {
 *   const res = await api.getComments(viewMode)
 *   return { comments: res.list, myComment: res.mine, commentCount: res.total }
 * }
 *
 * async function fetchFactory() {
 *   const res = await api.getFactory()
 *   return res.data  // 完整 factory 数据对象
 * }
 * &lt;/script&gt;
 */

import { ref, computed, reactive, onMounted } from 'vue'
import HsAvatarStack from './HsAvatarStack.vue'
import HsTagsPanel from './HsTagsPanel.vue'
import HsCommentList from './HsCommentList.vue'

const props = defineProps({
  width: { type: [Number, String], default: 240 },
  height: { type: Number, default: 160 },
  emptyMode: { type: Boolean, default: false },
  data: {
    type: Object,
    default: () => ({
      viewCount: 0,
      product: { myComment: null, myTags: [], tags: [], comments: [] },
      factory: { myComment: null, myTags: [], tags: [], comments: [] }
    })
  },
  // 主视图数据加载：async ({ viewMode }) => { myComment, myTags, viewers, tagCount, commentCount, ... }
  // mount 时自动拉取 product 数据；切换到工厂时自动拉取 factory 数据
  load: { type: Function, default: null },
  // 展开标签面板时懒加载：async ({ viewMode }) => { tags, myTags, tagCount? }
  loadTags: { type: Function, default: null },
  // 展开评论面板时懒加载：async ({ viewMode }) => { comments, myComment, commentCount? }
  loadComments: { type: Function, default: null },
})

const viewMode = ref('product')
const expanded = ref(null)
const slideDir = ref('slide-left')

// 懒加载回来的数据单独存放，不污染 props.data
const lazyData = reactive({ product: {}, factory: {} })

// 主视图加载状态：未提供 load 则视为已就绪
const viewLoaded = reactive({ product: !props.load, factory: !props.load })
const isViewLoading = computed(() => !viewLoaded[viewMode.value])

// 面板加载状态：按 viewMode 分开记录，商品/工厂各自独立懒加载
const loaded = reactive({
  product: { tags: !props.loadTags, comments: !props.loadComments },
  factory: { tags: !props.loadTags, comments: !props.loadComments },
})
const panelLoading = reactive({ tags: false, comments: false })

const isTagsLoaded = computed(() => loaded[viewMode.value].tags)
const isCommentsLoaded = computed(() => loaded[viewMode.value].comments)

// mount 时拉取初始商品视图数据
onMounted(async () => {
  if (props.load) {
    const result = await props.load({ viewMode: 'product' })
    if (result) Object.assign(lazyData.product, result)
    viewLoaded.product = true
  }
})

// props.data 提供基础数据，lazyData 覆盖懒加载回来的部分
const activeData = computed(() => ({
  ...props.data[viewMode.value],
  ...lazyData[viewMode.value],
}))

const tagCount = computed(() => {
  const d = activeData.value
  if (typeof d.tagCount === 'number') return d.tagCount
  return (d.tags?.length ?? 0) + (d.myTags?.length ?? 0)
})

const commentCount = computed(() => {
  const d = activeData.value
  if (typeof d.commentCount === 'number') return d.commentCount
  return (d.comments?.length ?? 0) + (d.myComment ? 1 : 0)
})

function getInitial(name) {
  if (!name) return '?'
  return name.charAt(0)
}

const avatarData = computed(() =>
  (activeData.value.viewers || []).map(v => ({
    initial: getInitial(v.name),
    tooltip: v.tip || v.name,
  }))
)

const expandedTags = computed(() => {
  const d = activeData.value
  const my = (d.myTags || []).map(t => ({ text: t.text, tooltip: t.date ? `我的标签 · ${t.date}` : '我的标签' }))
  const others = (d.tags || []).map(t => ({ text: t.text, tooltip: t.author ? `${t.author} · ${t.date || ''}` : '' }))
  return [...my, ...others]
})

const expandedComments = computed(() => {
  const d = activeData.value
  const result = []
  if (d.myComment) {
    result.push({
      text: d.myComment.text,
      user_name: '我',
      initial: 'C',
      date: d.myComment.date,
      color: d.myComment.color || '#ff6a00',
      tooltip: `我：${d.myComment.text}`,
    })
  }
  ;(d.comments || []).forEach(c => {
    result.push({
      text: c.text,
      user_name: c.author,
      initial: getInitial(c.author),
      date: c.date,
      color: c.color || '#3498db',
      tooltip: `${c.author}：${c.text}`,
    })
  })
  return result
})

async function expandPanel(panel) {
  if (expanded.value === panel) {
    expanded.value = null
    return
  }

  // 先展开面板，loading 立即可见
  expanded.value = panel

  const mode = viewMode.value

  if (panel === 'tags' && !loaded[mode].tags) {
    panelLoading.tags = true
    try {
      const result = await props.loadTags({ viewMode: mode })
      if (result) Object.assign(lazyData[mode], result)
    } finally {
      loaded[mode].tags = true
      panelLoading.tags = false
    }
  }

  if (panel === 'comments' && !loaded[mode].comments) {
    panelLoading.comments = true
    try {
      const result = await props.loadComments({ viewMode: mode })
      if (result) Object.assign(lazyData[mode], result)
    } finally {
      loaded[mode].comments = true
      panelLoading.comments = false
    }
  }
}

async function toggleView() {
  const next = viewMode.value === 'product' ? 'factory' : 'product'
  slideDir.value = next === 'factory' ? 'slide-left' : 'slide-right'
  // 先切视图，再加载——动画即时响应，loading 在新视图的 body 里显示
  viewMode.value = next
  expanded.value = null

  if (!viewLoaded[next] && props.load) {
    const result = await props.load({ viewMode: next })
    if (result) Object.assign(lazyData[next], result)
    viewLoaded[next] = true
  }
}
</script>

<style scoped>
.hs-card {
  position: relative;
  overflow: hidden;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
}

.hs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 4px;
}

.hs-empty span {
  font-size: 11px;
  color: #ccc;
}

/* ── 顶栏 ── */
.hs-bar {
  display: flex;
  align-items: center;
  padding: 4px 6px;
  gap: 4px;
  border-bottom: 1px solid #f0f0f0;
  pointer-events: auto;
  flex-shrink: 0;
}

.hs-pills {
  display: flex;
  background: #f3f3f3;
  border-radius: 8px;
  padding: 1px;
  flex-shrink: 0;
}

.hs-p {
  font-size: 8px;
  color: #aaa;
  font-weight: 500;
  padding: 2px 5px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.2;
}

.hs-p:hover {
  color: #666;
}

.hs-p.on {
  background: #ff6a00;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(255, 106, 0, 0.25);
}

.hs-nums {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.hs-n {
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  transition: background 0.12s;
  white-space: nowrap;
}

.hs-n:hover {
  background: rgba(0, 0, 0, 0.04);
}

.hs-n.on {
  background: rgba(255, 106, 0, 0.08);
}

.hs-n b {
  font-size: 10px;
  font-weight: 700;
  color: #333;
  line-height: 1;
}

.hs-n.on b {
  color: #ff6a00;
}

.hs-n i {
  font-size: 7px;
  color: #bbb;
  font-style: normal;
  line-height: 1;
}

/* ── 内容区包裹 ── */
.hs-body-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  pointer-events: auto;
  position: relative;
}

.hs-body {
  position: absolute;
  inset: 0;
  padding: 6px 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* ── 个人视角 ── */
.hs-personal {
  gap: 8px;
  justify-content: center;
  background: #faf8f5;
  border-radius: 0 0 7px 7px;
}

.hs-note {
  flex: 1;
  padding-left: 10px;
  border-left: 2.5px solid #c87941;
}

.hs-note--empty {
  border-left-color: #e0d8cc;
  cursor: pointer;
}

.hs-note--empty:hover {
  border-left-color: #c87941;
}

.hs-note-text {
  font-size: 12px;
  color: #5a4e3e;
  line-height: 1.7;
  letter-spacing: 0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hs-note-text--empty {
  color: #c8c0b4;
  font-style: italic;
  font-size: 11px;
}

.hs-note-meta {
  font-size: 9px;
  color: #c0b8a8;
  margin-top: 4px;
}

.hs-bottom {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hs-my-tags {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.hs-my-tags::-webkit-scrollbar {
  display: none;
}

.hs-my-tag {
  font-size: 9px;
  line-height: 16px;
  padding: 0 7px;
  border-radius: 8px;
  background: #efe9e0;
  color: #8a7e6e;
  font-weight: 500;
  white-space: nowrap;
  cursor: default;
  flex-shrink: 0;
}

.hs-my-tags--empty {
  font-size: 9px;
  color: #c0b8a8;
  white-space: nowrap;
}

.hs-view-count {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #bbb;
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 4px;
}

.hs-view-count svg {
  opacity: 0.6;
}

.hs-view-count b {
  font-size: 9px;
  font-weight: 600;
  color: #aaa;
}

/* ── 加载中 ── */
.hs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.hs-loading-dots {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}

.hs-loading-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ccc;
  animation: hs-dot-bounce 0.6s infinite alternate;
}

.hs-loading-dots i:nth-child(2) {
  animation-delay: 0.2s;
}

.hs-loading-dots i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes hs-dot-bounce {
  to {
    opacity: 0.3;
    transform: translateY(-3px);
  }
}

.hs-p--loading {
  opacity: 0.5;
}

/* ── 切换动画 ── */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.slide-left-enter-from {
  transform: translateX(30px);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-30px);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(30px);
  opacity: 0;
}
</style>
