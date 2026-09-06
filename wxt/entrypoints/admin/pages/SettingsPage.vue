<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app.js'

const appStore = useAppStore()

const boxDefault = ref('product')
const serverAddress = ref('')

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

onMounted(async () => {
  const stored = await browser.storage.local.get(['boxDefault', 'serverAddress', 'toolbarConfig', 'appSettings'])
  if (stored.boxDefault) boxDefault.value = stored.boxDefault
  if (stored.serverAddress) serverAddress.value = stored.serverAddress
  if (stored.toolbarConfig) Object.assign(toolbarConfig.value, stored.toolbarConfig)

  if (stored.appSettings) {
    pageSwitches.value.enableSearchList = stored.appSettings.enableSearchList ?? true
    pageSwitches.value.enableOfferList = stored.appSettings.enableOfferList ?? true
    pageSwitches.value.enableHomeRecommend = stored.appSettings.enableHomeRecommend ?? true
    pageSwitches.value.enableShopPage = stored.appSettings.enableShopPage ?? true
    pageSwitches.value.enableStopLoading = stored.appSettings.enableStopLoading ?? true
  }
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
    enableStopLoading: pageSwitches.value.enableStopLoading,
  }

  // 同步内存
  Object.assign(appStore.config.settings, {
    enableSearchList: pageSwitches.value.enableSearchList,
    enableOfferList: pageSwitches.value.enableOfferList,
    enableHomeRecommend: pageSwitches.value.enableHomeRecommend,
    enableShopPage: pageSwitches.value.enableShopPage,
    enableStopLoading: pageSwitches.value.enableStopLoading,
  })

  // 保存全部
  await browser.storage.local.set({
    appSettings,
    boxDefault: boxDefault.value,
    serverAddress: serverAddress.value,
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
        <el-form-item label="服务器地址">
          <el-input v-model="serverAddress" placeholder="http://localhost:3000" @blur="autoSave" />
        </el-form-item>
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
        <el-form-item label="停止页面加载">
          <el-switch v-model="pageSwitches.enableStopLoading" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">进入商品详情页时自动停止页面加载，有些页面可能无法加载详情页，默认关闭</div>
        </el-form-item>
      </el-form>
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
</style>
