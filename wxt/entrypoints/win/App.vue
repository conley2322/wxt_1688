<!-- win/App.vue - 重构后主布局 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DraggableWindow from './components/DraggableWindow.vue'
import HsAvatarStack from '../../components/HsAvatarStack.vue'
import { useApiStore } from '@/stores/api/api.js'
import { useDomStore } from '@/stores/dom.js'
import stopLoading from '@/utils/stopLoading.js'



const route = useRoute()
const router = useRouter()
const store = useApiStore()
const domStore = useDomStore()
const viewerStats = ref([])
const productDom = ref({})
const currentTab = computed(() => {
  if (route.path.startsWith('/product')) return 'product'
  if (route.path.startsWith('/supplier')) return 'supplier'
  if (route.path.startsWith('/analysis')) return 'analysis'
  return 'product'
})
// ── 挂载时从页面抓取真实数据 ──
onMounted(async () => {
  console.log('App mounted win页面')

  // 读取设置，决定是否停止页面加载
  const stored = await browser.storage.local.get('appSettings')
  if (stored.appSettings?.enableStopLoading !== false) {
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
        count: v.count
      }))
    }

    // 自动创建供应商（后台静默）
    if (data.CompanyName) {
      store.createSupplier(data.CompanyName, data.memberId).catch(() => {})
    }
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

// ── 头像栈数据 ──
const viewerAvatars = computed(() =>
  viewerStats.value.map(v => ({ initial: v.initial, tooltip: `${v.name} · ${v.count}次` }))
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
          <HsAvatarStack :viewers="viewerAvatars" :maxShow="3" variant="product" />
        </div>
      </div>
    </div>

    <!-- 主 Tab 栏 -->
    <div class="main-tabs">
      <span
        v-for="tab in [{ key: 'product', label: '商品' }, { key: 'supplier', label: '供应商' }]"
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
</style>