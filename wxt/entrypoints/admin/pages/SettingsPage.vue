<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app.js'
import { getProfile } from '@/utils/localdb.js'
import {
  getRemoteConfig, connectAndRegister, updateNickname,
  disconnect, saveRemoteConfig,
} from '@/utils/remoteClient.js'

const appStore = useAppStore()

const boxDefault = ref('product')

// 富文本工具栏配置（精简：仅保留常用项，避免窗口内换行）
const toolbarConfig = ref({
  bold: true,
  italic: true,
  image: true,
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
  enableCleanUrl: true,
})

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

// ════════════════════════════════════
// 服务器连接（多人共享）
// ════════════════════════════════════
const connected = ref(false)
const connecting = ref(false)
const syncing = ref(false)
const serverInput = ref('')
const nicknameInput = ref('')
const shareEnabled = ref(false)
const multi = ref({ showOthersComments: true, showOthersViews: true, showOnListPage: true })
const syncText = ref('尚未同步')

async function refreshRemote() {
  const cfg = await getRemoteConfig()
  connected.value = !!cfg.serverAddress
  if (cfg.serverAddress) serverInput.value = cfg.serverAddress
  nicknameInput.value = cfg.nickname
  shareEnabled.value = cfg.shareEnabled
  multi.value = cfg.multiSettings
  syncText.value = cfg.syncState.last_pull_at
    ? new Date(cfg.syncState.last_pull_at).toLocaleString('zh-CN', { hour12: false })
    : '尚未同步'
}

// 连接并注册
async function onConnect() {
  connecting.value = true
  try {
    await connectAndRegister(serverInput.value, nicknameInput.value)
    ElMessage.success('连接成功，已完成首次同步')
    refreshRemote()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    connecting.value = false
  }
}

// 修改昵称
async function onChangeNickname() {
  try {
    await updateNickname(nicknameInput.value)
    ElMessage.success('昵称已更新')
  } catch (e) {
    ElMessage.error(e.message)
    refreshRemote()
  }
}

// 共享同意开关
async function onShareChange(v) {
  await saveRemoteConfig({ shareEnabled: v })
  ElMessage.success(v ? '已同意共享，下次同步时上传数据' : '已关闭共享')
  if (v) onManualSync()
}

// 三个他人数据展示开关
async function saveMulti() {
  await saveRemoteConfig({ multiSettings: { ...multi.value } })
}

// 立即同步（交给 background 执行）
async function onManualSync() {
  syncing.value = true
  try {
    const res = await browser.runtime.sendMessage({ type: 'remote-sync' })
    if (res.code !== 200) throw new Error(res.message)
    ElMessage.success('同步完成')
    refreshRemote()
  } catch (e) {
    ElMessage.error('同步失败：' + e.message)
  } finally {
    syncing.value = false
  }
}

// 断开连接，回到单机模式
async function onDisconnect() {
  try {
    await ElMessageBox.confirm(
      '断开后将回到单机模式，不再显示他人数据，本机数据保留。',
      '断开连接', { type: 'warning', confirmButtonText: '断开', cancelButtonText: '取消' }
    )
  } catch { return }
  await disconnect()
  ElMessage.success('已断开连接')
  refreshRemote()
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
    pageSwitches.value.enableCleanUrl = stored.appSettings.enableCleanUrl ?? true
  }
  loadStorage()
  await refreshRemote()
  // 未连接且昵称为空时，用个人资料昵称预填
  if (!connected.value && !nicknameInput.value) {
    const p = await getProfile()
    if (p.nickname && p.nickname !== '我') nicknameInput.value = p.nickname
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
    enableCleanUrl: pageSwitches.value.enableCleanUrl,
  }

  // 同步内存
  Object.assign(appStore.config.settings, {
    enableSearchList: pageSwitches.value.enableSearchList,
    enableOfferList: pageSwitches.value.enableOfferList,
    enableHomeRecommend: pageSwitches.value.enableHomeRecommend,
    enableShopPage: pageSwitches.value.enableShopPage,
    enableStopLoading: pageSwitches.value.enableStopLoading,
    enableCleanUrl: pageSwitches.value.enableCleanUrl,
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

    <!-- 服务器连接（多人共享） -->
    <el-card style="margin-bottom:16px">
      <template #header>服务器连接 · 多人共享</template>

      <!-- 未连接：填写地址+昵称 -->
      <el-form v-if="!connected" label-width="100px">
        <el-form-item label="服务器地址">
          <el-input
            v-model="serverInput"
            placeholder="http://192.168.1.100:3000"
            style="width:320px"
          />
        </el-form-item>
        <el-form-item label="我的昵称">
          <el-input
            v-model="nicknameInput"
            placeholder="如：阿康"
            style="width:200px"
            maxlength="20"
            @keyup.enter="onConnect"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="connecting" @click="onConnect">连接并注册</el-button>
          <span class="switch-desc" style="margin-left:12px">不连接即为单机模式，数据只保存在本机</span>
        </el-form-item>
      </el-form>

      <!-- 已连接：状态、共享开关、他人数据开关 -->
      <el-form v-else label-width="110px">
        <el-form-item label="连接状态">
          <el-tag type="success" size="small">已连接</el-tag>
          <span style="margin-left:10px;color:#606266;font-size:13px">{{ serverInput }}</span>
        </el-form-item>
        <el-form-item label="我的昵称">
          <el-input
            v-model="nicknameInput"
            style="width:160px"
            maxlength="20"
            @change="onChangeNickname"
          />
        </el-form-item>
        <el-form-item label="最近同步">
          <span style="color:#606266;font-size:13px">{{ syncText }}</span>
          <el-button size="small" style="margin-left:12px" :loading="syncing" @click="onManualSync">立即同步</el-button>
        </el-form-item>

        <el-divider content-position="left">数据共享</el-divider>
        <el-form-item label="共享我的数据">
          <el-switch
            v-model="shareEnabled"
            active-text="同意共享"
            inactive-text="不共享"
            @change="onShareChange"
          />
          <div class="switch-desc">同意后，我的笔记与浏览/出现流水将上传服务器、团队可见；不共享也能查看他人数据</div>
        </el-form-item>

        <el-divider content-position="left">他人数据展示</el-divider>
        <el-form-item label="他人笔记">
          <el-switch v-model="multi.showOthersComments" @change="saveMulti" />
          <div class="switch-desc">商品/供应商详情中显示其他人的笔记</div>
        </el-form-item>
        <el-form-item label="他人浏览数量">
          <el-switch v-model="multi.showOthersViews" @change="saveMulti" />
          <div class="switch-desc">数据页显示其他人的浏览、出现次数</div>
        </el-form-item>
        <el-form-item label="列表页显示">
          <el-switch v-model="multi.showOnListPage" @change="saveMulti" />
          <div class="switch-desc">1688 搜索/店铺列表卡片上显示其他人的笔记与数量</div>
        </el-form-item>

        <el-form-item>
          <el-button type="danger" plain @click="onDisconnect">断开连接（回到单机模式）</el-button>
        </el-form-item>
      </el-form>
    </el-card>

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
        <el-form-item label="停止页面加载">
          <el-switch v-model="pageSwitches.enableStopLoading" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">进入商品详情页时自动停止页面加载，有些页面可能无法加载详情页，默认关闭</div>
        </el-form-item>
        <el-form-item label="净化详情页链接">
          <el-switch v-model="pageSwitches.enableCleanUrl" active-text="开启" inactive-text="关闭" @change="autoSave" />
          <div class="switch-desc">进入详情页自动去掉链接后缀参数，页面右侧出现悬浮按钮可一键复制干净链接</div>
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
            商品 {{ storage.counts.products }} · 浏览记录 {{ storage.counts.view_records }} · 评论 {{ storage.counts.comments }} · 供应商 {{ storage.counts.suppliers }}
          </span>
        </el-form-item>
        <el-form-item label="自动清理上限">
          <el-input-number v-model="quotaInput" :min="10" :max="1024" :step="10" @change="saveQuota" />
          <span style="margin-left:8px;color:#999;font-size:12px">MB — 超过上限时自动删除最旧的浏览记录（评论不受影响）</span>
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
          <el-checkbox v-model="toolbarConfig.image" @change="autoSave">插入图片</el-checkbox>
          <span class="switch-desc">评论框内可直接 Ctrl+V 粘贴截图</span>
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
