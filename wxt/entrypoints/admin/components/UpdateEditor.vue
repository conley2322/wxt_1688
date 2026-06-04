<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, DocumentAdd, View, Clock } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app.js'
import { api } from './useApi.js'

const router = useRouter()
const appStore = useAppStore()

const version = ref('')
const title = ref('')
const content = ref('')
const showPreview = ref(false)
const previewContent = ref('')
const saving = ref(false)
const publishing = ref(false)

function goBack() {
  router.push('/updates')
}

async function saveDraft() {
  if (!version.value || !title.value) {
    ElMessage.warning('请填写版本号和标题')
    return
  }
  if (!content.value.trim()) {
    ElMessage.warning('请填写更新内容')
    return
  }

  saving.value = true
  try {
    const res = await api('/api/v1/updates', 'POST', {
      version: version.value,
      title: title.value,
      content: formatContent(content.value),
      status: 'draft'
    })
    if (res.code === 200) {
      ElMessage.success('草稿保存成功')
      resetForm()
    }
  } catch (e) {
    console.error('保存失败:', e)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function publish() {
  if (!version.value || !title.value) {
    ElMessage.warning('请填写版本号和标题')
    return
  }
  if (!content.value.trim()) {
    ElMessage.warning('请填写更新内容')
    return
  }

  try {
    await ElMessageBox.confirm('确定发布这条更新吗？发布后将显示在用户端。', '确认发布', {
      confirmButtonText: '确认发布',
      cancelButtonText: '取消',
      type: 'info'
    })
  } catch {
    return
  }

  publishing.value = true
  try {
    const res = await api('/api/v1/updates', 'POST', {
      version: version.value,
      title: title.value,
      content: formatContent(content.value),
      status: 'published'
    })
    if (res.code === 200) {
      ElMessage.success('发布成功！')
      router.push('/updates')
    }
  } catch (e) {
    console.error('发布失败:', e)
    ElMessage.error('发布失败')
  } finally {
    publishing.value = false
  }
}

function formatContent(text) {
  const lines = text.trim().split('\n')
  const items = lines.filter(line => line.trim())
  if (items.length === 0) return ''
  return `<ul>${items.map(item => `<li>${item.trim()}</li>`).join('')}</ul>`
}

function preview() {
  if (!content.value.trim()) {
    ElMessage.warning('请先填写更新内容')
    return
  }
  previewContent.value = formatContent(content.value)
  showPreview.value = true
}

function resetForm() {
  version.value = ''
  title.value = ''
  content.value = ''
}
</script>

<template>
  <section class="publish-section">
    <!-- 顶部返回栏 -->
    <div class="page-topbar">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回更新日志
      </el-button>
    </div>

    <!-- 产品信息卡片 -->
    <el-card class="product-card" shadow="hover">
      <div class="product-card-inner">
        <div class="logo-wrap">
          <img src="/logo.svg" alt="Logo" width="36" height="36" />
        </div>
        <div class="product-info">
          <div class="product-name">{{ appStore.config.app.name }}</div>
          <div class="product-sub">发布新的版本更新</div>
        </div>
      </div>
    </el-card>

    <!-- 编辑器卡片 -->
    <el-card class="editor-card" shadow="hover">
      <!-- 卡片头部 -->
      <template #header>
        <div class="card-header">
          <el-icon :size="18" color="#6366f1"><DocumentAdd /></el-icon>
          <span>新建更新公告</span>
        </div>
      </template>

      <!-- el-row 双栏 -->
      <el-row :gutter="24">
        <!-- 左侧：版本信息 -->
        <el-col :span="8">
          <div class="left-panel">
            <div class="panel-title">版本信息</div>

            <el-form label-position="top" :model="{ version, title }">
              <el-form-item label="版本号">
                <el-input
                  v-model="version"
                  placeholder="例如：1.0.0"
                  size="large"
                  clearable
                />
              </el-form-item>

              <el-form-item label="更新标题">
                <el-input
                  v-model="title"
                  placeholder="例如：正式发布"
                  size="large"
                  clearable
                />
              </el-form-item>

              <el-form-item label="发布状态">
                <div class="status-hint">
                  <span class="status-dot"></span>
                  <span>发布后所有人可见</span>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-col>

        <!-- 右侧：内容编辑 -->
        <el-col :span="16">
          <div class="right-panel">
            <div class="panel-title">
              更新内容
              <span class="panel-hint">每行一条更新记录</span>
            </div>

            <el-input
              v-model="content"
              type="textarea"
              placeholder="请输入更新内容，每行一条…&#10;&#10;例如：&#10;新增商品管理瀑布流视图&#10;支持评论图片点击放大查看&#10;优化搜索筛选功能&#10;修复若干已知问题"
              :rows="14"
              :autosize="{ minRows: 14, maxRows: 22 }"
              resize="vertical"
            />

            <!-- 操作按钮 -->
            <div class="action-bar">
              <div class="action-bar-left">
                <el-button size="default" @click="saveDraft" :loading="saving">
                  <el-icon><Clock /></el-icon>
                  保存草稿
                </el-button>
                <el-button size="default" @click="preview">
                  <el-icon><View /></el-icon>
                  预览
                </el-button>
              </div>
              <el-button class="publish-btn" type="primary" size="default" @click="publish" :loading="publishing">
                <span v-if="!publishing">🚀</span>
                发布
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="showPreview"
      title="预览效果"
      width="520px"
      :close-on-click-modal="true"
      destroy-on-close
    >
      <div class="preview-block">
        <div class="preview-label">v{{ version }} {{ title }}</div>
        <div class="preview-body" v-html="previewContent"></div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showPreview = false">关闭预览</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
/* ── 页面容器 ── */
.publish-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 0 48px;
}

/* ── 顶部返回栏 ── */
.page-topbar {
  margin-bottom: 16px;
}

/* ── 产品卡片 ── */
.product-card {
  margin-bottom: 16px;
  border: none;
  border-radius: 10px;
}

.product-card :deep(.el-card__body) {
  padding: 18px 24px;
}

.product-card-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-wrap {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-wrap img {
  filter: brightness(0) invert(1);
  opacity: 0.95;
}

.product-name {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.product-sub {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 2px;
}

/* ── 编辑器卡片 ── */
.editor-card {
  border-radius: 10px;
  border: none;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

/* ── 左侧面板 ── */
.left-panel {
  padding-right: 4px;
}

.left-panel .panel-title {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

/* ── 右侧面板 ── */
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.right-panel .panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-hint {
  font-size: 12px;
  font-weight: 400;
  color: #94a3b8;
}

/* ── textarea 微调 ── */
.right-panel :deep(.el-textarea__inner) {
  font-size: 13px;
  line-height: 1.8;
  font-family: inherit;
}

/* ── 状态提示 ── */
.status-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  font-size: 13px;
  color: #15803d;
  font-weight: 500;
  width: 100%;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(34,197,94,0.2);
}

/* ── 操作栏 ── */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid #e2e8f0;
}

.action-bar-left {
  display: flex;
  gap: 8px;
}

/* 发布按钮增强 */
.publish-btn {
  padding: 0 22px !important;
  font-weight: 600 !important;
  letter-spacing: 0.2px;
  box-shadow: 0 2px 8px rgba(99,102,241,0.3), 0 4px 16px rgba(99,102,241,0.15) !important;
  transition: box-shadow 150ms ease, transform 150ms ease !important;
}

.publish-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99,102,241,0.4), 0 6px 20px rgba(99,102,241,0.2) !important;
}

/* ── 预览弹窗内容 ── */
.preview-block {
  padding: 0 4px;
}

.preview-label {
  font-size: 16px;
  font-weight: 700;
  color: #6366f1;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
}

.preview-body {
  font-size: 14px;
  color: #475569;
  line-height: 1.9;
}

.preview-body :deep(ul) {
  list-style: none;
  padding: 0;
  margin: 0;
}

.preview-body :deep(li) {
  position: relative;
  padding: 5px 0 5px 20px;
}

.preview-body :deep(li::before) {
  content: '';
  position: absolute;
  left: 4px;
  top: 14px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #6366f1;
  opacity: 0.35;
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .el-row {
    display: block;
  }
}
</style>
