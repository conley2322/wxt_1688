<!-- win/App.vue - 重构后主布局 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DraggableWindow from './components/DraggableWindow.vue'
import { useApiStore } from '@/stores/api/api.js'
import { useDomStore } from '@/stores/dom.js'
import { api as dataApi } from '@/utils/dataClient.js'
import stopLoading from '@/utils/stopLoading.js'



const route = useRoute()
const router = useRouter()
const store = useApiStore()
const domStore = useDomStore()
const viewerStats = ref([])
const productDom = ref({})
// ── 详情页停留计时（活跃度规则）：
//    页面可见 + 最近 3 秒内有鼠标/键盘动作 → 每秒 +1；
//    鼠标静止超 3 秒（挂机）或切到别的标签页 → 暂停；
//    关闭/切走时把本次时长回填浏览流水（后台可看）──
const dwellSeconds = ref(0)
const dwellViewedAt = ref(0)
const dwellText = computed(() => {
  const s = dwellSeconds.value
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}分${String(s % 60).padStart(2, '0')}秒` : `${s}秒`
})
let lastDwellActivity = Date.now()
let reportedDwell = 0 // 本次页面会话已上报过的秒数（只报增量，避免切走/关掉多次上报重复累加）
const markDwellActive = () => { lastDwellActivity = Date.now() }
;['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'].forEach(ev =>
  document.addEventListener(ev, markDwellActive, { passive: true, capture: true }))
function reportDwell() {
  if (!dwellViewedAt.value || !store.currentOfferId) return
  const delta = dwellSeconds.value - reportedDwell
  if (delta <= 0) return
  reportedDwell = dwellSeconds.value
  try {
    dataApi('/api/v1/view_records/duration', 'POST', {
      offer_id: store.currentOfferId,
      viewed_at: dwellViewedAt.value,
      duration: delta, // 增量：后端累加到流水（5 分钟合并窗口内的刷新也累到同一条）
    })
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') reportDwell()
})
window.addEventListener('pagehide', reportDwell)
setInterval(() => {
  if (document.visibilityState !== 'visible') return // 切到别的标签页不计时
  if (Date.now() - lastDwellActivity > 3000) return // 鼠标静止超 3 秒不计时
  dwellSeconds.value++
}, 1000)
const currentTab = computed(() => {
  if (route.path.startsWith('/product')) return 'product'
  if (route.path.startsWith('/supplier')) return 'supplier'
  if (route.path.startsWith('/analysis')) return 'analysis'
  return 'product'
})
// ── 挂载时从页面抓取真实数据 ──
onMounted(async () => {
  console.log('App mounted win页面')

  // 读取设置，决定是否停止页面加载（显式开启才停；默认值 false，见 stores/app.js）
  // 修复：原来的 `!== false` 判断在设置未写入时也会 window.stop()，
  // 把详情页加载拦腰截断，偶发整页空白只剩加载符
  const stored = await browser.storage.local.get('appSettings')
  if (stored.appSettings?.enableStopLoading === true) {
    stopLoading()
  }

  // 初始化用户
  await store.initUser()

  // 抓取页面 DOM 数据
  const data = await domStore.get_dom_all_data()
  console.log(data)
  productDom.value = data

  if (!data.productId) return

  // 设置当前商品
  store.currentOfferId = data.productId
  store.currentSupplierName = data.CompanyName || ''
  store.currentSupplierMemberId = data.memberId || ''

    try {
    // 上传浏览记录（后端自动处理商品入库 + 字段补充）
    const res = await store.recordBrowsing(
      data.productId,
      data.title,
      data.imageUrl,
      data.CompanyName
    )

    if (res.data) {
      viewerStats.value = res.data.viewers.map(v => ({
        initial: v.initial,
        name: v.username,
        avatar_color: v.avatar_color || null,
        count: v.count
      }))
      // 停留计时基准：本次浏览流水的时间戳，离开时按它精确回填时长
      dwellViewedAt.value = res.data.viewed_at || 0
    }

    // 自动创建供应商（后台静默）
    if (data.CompanyName) {
      store.createSupplier(data.CompanyName, data.memberId).catch(() => {})
    }

    // 采集卖家登录 ID → 店铺公司名 映射（旺旺客服页据此把会话对应到真实供应商）
    // 详情页内联脚本里有 "sellerLoginId":"xxx"（隔离世界读不到主世界的 window.context，走脚本正则）
    try {
      const sellerLoginId = (() => {
        for (const s of document.querySelectorAll('script')) {
          const m = (s.textContent || '').match(/"sellerLoginId"\s*:\s*"([^"]{2,40})"/)
          if (m) return m[1]
        }
        return ''
      })()
      if (sellerLoginId && data.CompanyName) {
        dataApi('/api/v1/suppliers/bind-loginid', 'POST', { login_id: sellerLoginId, supplier_name: data.CompanyName }).catch(() => {})
      }
    } catch {}
  } catch (e) {
    console.error('Win 初始化失败:', e)
  }
})

// ── 导航到 Tab ──
function goToTab(tab) {
  switch (tab) {
    case 'product': router.push('/product'); break
    case 'supplier': router.push('/supplier'); break
    case 'analysis': router.push('/analysis'); break
  }
}

// ── 浏览次数汇总 ──
const totalViewCount = computed(() =>
  viewerStats.value.reduce((s, v) => s + v.count, 0)
)

// ── 头像颜色（用户自选 > 哈希降级） ──
const colorPool = ['#ff6a00', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#34495e']
function avatarColor(v) {
  if (v.avatar_color) return v.avatar_color
  let hash = 0
  for (let i = 0; i < (v.name || '').length; i++) hash = (v.name || '').charCodeAt(i) + ((hash << 5) - hash)
  return colorPool[Math.abs(hash) % colorPool.length]
}

// ── 头像栈数据 ──
const viewerAvatars = computed(() =>
  viewerStats.value.map(v => ({
    initial: v.initial,
    tooltip: `${v.name} · ${v.count}次`,
    color: avatarColor(v)
  }))
)

</script>

<template>
  <DraggableWindow title="1688 协作">
    <!-- 产品概览区：左图右信息 -->
    <div class="product-overview">
      <img class="overview-thumb" :src="productDom.imageUrl" alt="" />
      <div class="overview-info">
        <div class="overview-title" :title="productDom.title">{{ productDom.title }}</div>
        <div class="overview-supplier" :title="productDom.CompanyName">{{ productDom.CompanyName }}
        </div>
        <div class="overview-stats">
          <span class="view-count">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {{ totalViewCount }}次
          </span>
          <span class="dwell-count" title="本次在详情页的停留时长">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ dwellText }}
          </span>
          <span class="avatar-stack">
            <span
              v-for="(v, i) in viewerAvatars.slice(0, 3)"
              :key="i"
              class="avatar-dot"
              :style="{ background: v.color, zIndex: viewerAvatars.length - i }"
              :title="v.tooltip"
            >{{ v.initial }}</span>
            <span v-if="viewerAvatars.length > 3" class="avatar-more">+{{ viewerAvatars.length - 3 }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 主 Tab 栏 -->
    <div class="main-tabs">
      <span
        v-for="tab in [{ key: 'product', label: '商品' }, { key: 'supplier', label: '供应商' }, { key: 'analysis', label: '数据' }]"
        :key="tab.key" class="main-tab" :class="{ active: currentTab === tab.key }" @click="goToTab(tab.key)">
        {{ tab.label }}
      </span>
    </div>

    <!-- 内容区 -->
    <div class="content-area">
      <router-view />
    </div>
  </DraggableWindow>
</template>

<style scoped>
/* ── 产品概览区 ── */
.product-overview {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.overview-thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.overview-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.overview-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.overview-supplier {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.overview-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
}

.view-count {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
}

.dwell-count {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #c9975c;
  white-space: nowrap;
}

/* ── 主 Tab 栏 ── */
.main-tabs {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
}

.main-tab {
  flex: 1;
  text-align: center;
  padding: 7px 0;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.main-tab.active {
  color: #1677ff;
  font-weight: 600;
}

.main-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background: #1677ff;
}

/* ── 内容区 ── */
.content-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.content-area::-webkit-scrollbar {
  width: 3px;
}

.content-area::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}

/* ── 头像栈 ── */
.avatar-stack { display: flex; align-items: center; margin-left: auto; flex-shrink: 0; }
.avatar-dot {
  width: 20px; height: 20px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 600; color: #fff;
  border: 1.5px solid #f5f6f8; flex-shrink: 0;
}
.avatar-dot:not(:first-child) { margin-left: -6px; }
.avatar-more {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: #e0e0e0; color: #999; font-size: 9px; font-weight: 500;
  border: 1.5px solid #f5f6f8; margin-left: -6px; flex-shrink: 0;
}
</style>