<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app.js'

const appStore = useAppStore()

const boxDefault = ref('product')

// 富文本工具栏配置
const toolbarConfig = ref({
  bold: true,
  italic: true,
  underline: true,
  strikethrough: false,
  heading: true,
  bulletList: true,
  orderedList: true,
  blockquote: false,
  code: false,
  link: true,
  image: false,
  fontSize: 'medium',
  fontColor: '#1a1a1a',
  fullscreen: true,
})

const fontSizeOptions = [
  { label: '小', value: 'small' },
  { label: '中', value: 'medium' },
  { label: '大', value: 'large' },
]

// 1688 页面渲染开关
const pageSwitches = ref({
  enableSearchList: true,
  enableOfferList: true,
  enableHomeRecommend: true,
  enableShopPage: true,
  enableStopLoading: true,
})

// box1 图表类型：bar=柱状图 / line=折线图
const box1ChartType = ref('line')

// ── 存储管理（单机版 IndexedDB）──
const storage = ref(null) // { usageMB, quotaMB, counts }
const quotaInput = ref(100)
const importing = ref(false)
const cleaning = ref(false)

async function loadStorage() {
  const res = await api('/api/v1/local/storage', 'GET')
  if (res.code === 200) {
    storage.value = res.data
    quotaInput.value = res.data.quotaMB
  }
}

async function saveQuota() {
  await api('/api/v1/local/quota', 'PUT', { quotaMB: quotaInput.value })
  ElMessage.success('存储上限已更新')
  loadStorage()
}

async function runCleanup() {
  cleaning.value = true
  const res = await api('/api/v1/local/cleanup', 'POST', {})
  cleaning.value = false
  if (res.data?.cleaned) {
    ElMessage.success(`清理完成，删除了 ${res.data.deleted} 条过期浏览记录`)
  } else {
    ElMessage.info('当前未超过存储上限，无需清理')
  }
  loadStorage()
}

async function exportData() {
  const res = await api('/api/v1/local/export', 'POST', {})
  if (res.code !== 200) return
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `alocs-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('备份文件已导出')
}

function onImportFile(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result)
      importing.value = true
      const res = await api('/api/v1/local/import', 'POST', { data, mode: 'merge' })
      importing.value = false
      if (res.code === 200) {
        ElMessage.success('导入成功，数据已合并到本机')
        loadStorage()
      } else {
        ElMessage.error(res.message || '导入失败')
      }
    } catch (err) {
      importing.value = false
      ElMessage.error('文件格式错误，导入失败')
    }
    ev.target.value = ''
  }
  reader.readAsText(file)
}

onMounted(async () => {
  const stored = await browser.storage.local.get(['boxDefault', 'toolbarConfig', 'appSettings'])
  if (stored.boxDefault) boxDefault.value = stored.boxDefault
  if (stored.toolbarConfig) Object.assign(toolbarConfig.value, stored.toolbarConfig)

  if (stored.appSettings) {
    pageSwitches.value.enableSearchList = stored.appSettings.enableSearchList ?? true
    pageSwitches.value.enableOfferList = stored.appSettings.enableOfferList ?? true
    pageSwitches.value.enableHomeRecommend = stored.appSettings.enableHomeRecommend ?? true
    pageSwitches.value.enableShopPage = stored.appSettings.enableShopPage ?? true
    pageSwitches.value.enableStopLoading = stored.appSettings.enableStopLoading ?? true
    box1ChartType.value = stored.appSettings.box1ChartType ?? 'line'
  }
  loadStorage()
})

// ── 所有设置修改后自动保存（无防抖，立即落盘）──
async function autoSave() {
  // 构建完整的 appSettings
  const appSettings = {
    autoCheckUpdate: appStore.config.settings.autoCheckUpdate,
    defaultProductView: appStore.config.settings.defaultProductView,
    enableSearchList: pageSwitches.value.enableSearchList,
    enableOfferList: pageSwitches.value.enableOfferList,
    enableHomeRecommend: pageSwitches.value.enableHomeRecommend,
    enableShopPage: pageSwitches.value.enableShopPage,
    box1ChartType: box1ChartType.value,
    enableStopLoading: pageSwitches.value.enableStopLoading,
  }

  // 同步内存
  Object.assign(appStore.config.settings, {
    enableSearchList: pageSwitches.value.enableSearchList,
    enableOfferList: pageSwitches.value.enableOfferList,
    enableHomeRecommend: pageSwitches.value.enableHomeRecommend,
    enableShopPage: pageSwitches.value.enableShopPage,
    box1ChartType: box1ChartType.value,
    enableStopLoading: pageSwitches.value.enableStopLoading,
  })

  // 保存全部
  await browser.storage.local.set({
    appSettings,
    boxDefault: boxDefault.value,
    toolbarConfig: toolbarConfig.value,
  })

  ElMessage({
    message: '已保存',
    type: 'success',
    duration: 1200,
    showClose: false,
  })
}
</script>

<template>
  <section>
    <h2 class="page-title">系统设置</h2>

    <el-card style="margin-bottom:16px">
      <template #header>基础设置</template>
      <el-form label-width="140px">
        <el-form-item label="Box 默认面板">
          <el-select v-model="boxDefault" @change="autoSave">
            <el-option label="商品信息" value="product" />
            <el-option label="供应商信息" value="supplier" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 1688 页面渲染开关 -->
    <el-card style="margin-bottom:16px">
      <template #header>1688 页面渲染开关（修改后自动保存）</template>
      <el-form label-width="180px">
        <el-form-item label="搜索列表页">
          <el-switch v-model="pageSwitches.enableSearchList" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">s.1688.com / search.1688.com 搜索结果页</div>
        </el-form-item>
        <el-form-item label="以图搜款页">
          <el-switch v-model="pageSwitches.enableOfferList" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">1688 货源/以图搜款页</div>
        </el-form-item>
        <el-form-item label="首页推荐">
          <el-switch v-model="pageSwitches.enableHomeRecommend" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">www.1688.com 首页推荐/精选货源卡片</div>
        </el-form-item>
        <el-form-item label="供应商店铺页">
          <el-switch v-model="pageSwitches.enableShopPage" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">shop***.1688.com 供应商店铺首页 / 全部商品(offerlist)页</div>
        </el-form-item>
        <el-form-item label="box1 图表样式">
          <el-radio-group v-model="box1ChartType" @change="autoSave">
            <el-radio-button value="line">折线图</el-radio-button>
            <el-radio-button value="bar">柱状图</el-radio-button>
          </el-radio-group>
          <div class="switch-desc">商品卡片 box1 显示"我最近 14 天浏览记录"的图表样式（X 轴日期、Y 轴次数），刷新 1688 页面后生效</div>
        </el-form-item>
        <el-form-item label="停止页面加载">
          <el-switch v-model="pageSwitches.enableStopLoading" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">进入商品详情页时自动停止页面加载，有些页面可能无法加载详情页，默认关闭</div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 存储管理（单机版 IndexedDB） -->
    <el-card style="margin-bottom:16px">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>存储管理（数据保存在本机浏览器）</span>
          <el-button size="small" @click="loadStorage">刷新用量</el-button>
        </div>
      </template>
      <el-form label-width="140px" v-if="storage">
        <el-form-item label="当前占用">
          <span class="storage-usage">{{ storage.usageMB }} MB</span>
          <el-progress
            :percentage="Math.min(100, +(storage.usageMB / storage.quotaMB * 100).toFixed(1))"
            :stroke-width="10"
            style="width:260px;margin-left:12px"
            :color="storage.usageMB / storage.quotaMB > 0.8 ? '#e74c3c' : '#c9975c'"
          />
        </el-form-item>
        <el-form-item label="数据条数">
          <span class="storage-counts">
            商品 {{ storage.counts.products }} · 浏览记录 {{ storage.counts.view_records }} · 评论 {{ storage.counts.comments }} · 标签 {{ storage.counts.tags }} · 供应商 {{ storage.counts.suppliers }}
          </span>
        </el-form-item>
        <el-form-item label="自动清理上限">
          <el-input-number v-model="quotaInput" :min="10" :max="1024" :step="10" @change="saveQuota" />
          <span style="margin-left:8px;color:#999;font-size:12px">MB — 超过上限时自动删除最旧的浏览记录（评论/标签不受影响）</span>
        </el-form-item>
        <el-form-item label="迁移备份">
          <el-button type="primary" plain @click="exportData">导出备份文件</el-button>
          <label class="import-btn">
            <input type="file" accept=".json" style="display:none" @change="onImportFile" />
            <el-button type="success" plain :loading="importing">导入备份文件</el-button>
          </label>
          <el-button type="warning" plain :loading="cleaning" @click="runCleanup">立即清理</el-button>
        </el-form-item>
      </el-form>
      <div v-else style="color:#999;font-size:13px">读取存储信息中...</div>
    </el-card>

    <!-- 富文本工具栏配置 -->
    <el-card>
      <template #header>评论编辑器工具栏（修改后自动保存）</template>
      <el-form label-width="100px">
        <el-form-item label="工具栏按钮">
          <el-checkbox v-model="toolbarConfig.bold" @change="autoSave">加粗</el-checkbox>
          <el-checkbox v-model="toolbarConfig.italic" @change="autoSave">斜体</el-checkbox>
          <el-checkbox v-model="toolbarConfig.underline" @change="autoSave">下划线</el-checkbox>
          <el-checkbox v-model="toolbarConfig.strikethrough" @change="autoSave">删除线</el-checkbox>
          <el-checkbox v-model="toolbarConfig.heading" @change="autoSave">标题</el-checkbox>
          <el-checkbox v-model="toolbarConfig.bulletList" @change="autoSave">无序列表</el-checkbox>
          <el-checkbox v-model="toolbarConfig.orderedList" @change="autoSave">有序列表</el-checkbox>
          <el-checkbox v-model="toolbarConfig.blockquote" @change="autoSave">引用块</el-checkbox>
          <el-checkbox v-model="toolbarConfig.code" @change="autoSave">代码块</el-checkbox>
          <el-checkbox v-model="toolbarConfig.link" @change="autoSave">插入链接</el-checkbox>
          <el-checkbox v-model="toolbarConfig.image" @change="autoSave">插入图片</el-checkbox>
        </el-form-item>
        <el-form-item label="全屏按钮">
          <el-switch v-model="toolbarConfig.fullscreen" active-text="显示" inactive-text="隐藏" @change="autoSave" />
        </el-form-item>
      </el-form>
    </el-card>
  </section>
</template>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0 0 20px; }
.switch-desc { font-size: 12px; color: #909399; margin-top: 4px; }
.storage-usage { font-size: 16px; font-weight: 700; color: #303133; }
.storage-counts { font-size: 13px; color: #606266; }
.import-btn { margin: 0 12px; }
</style>
