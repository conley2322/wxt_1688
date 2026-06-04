<script setup>
import { ref } from 'vue'
import { api } from './useApi.js'

const version = ref('')
const title = ref('')
const content = ref('')
const showPreview = ref(false)
const previewContent = ref('')

async function saveDraft() {
  if (!version.value || !title.value) {
    alert('请填写版本号和标题')
    return
  }
  if (!content.value.trim()) {
    alert('请填写更新内容')
    return
  }

  try {
    const res = await api('/api/v1/updates', 'POST', {
      version: version.value,
      title: title.value,
      content: formatContent(content.value),
      status: 'draft'
    })
    if (res.code === 200) {
      alert('草稿保存成功')
      resetForm()
    }
  } catch (e) {
    console.error('保存失败:', e)
    alert('保存失败')
  }
}

async function publish() {
  if (!version.value || !title.value) {
    alert('请填写版本号和标题')
    return
  }
  if (!content.value.trim()) {
    alert('请填写更新内容')
    return
  }
  if (!confirm('确定发布这条更新吗？')) return

  try {
    const res = await api('/api/v1/updates', 'POST', {
      version: version.value,
      title: title.value,
      content: formatContent(content.value),
      status: 'published'
    })
    if (res.code === 200) {
      alert('发布成功')
      resetForm()
    }
  } catch (e) {
    console.error('发布失败:', e)
    alert('发布失败')
  }
}

function formatContent(text) {
  const lines = text.trim().split('\n')
  const items = lines.filter(line => line.trim())
  if (items.length === 0) return ''
  return `<ul>${items.map(item => `<li>${item.trim()}</li>`).join('')}</ul>`
}

function preview() {
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
  <section class="app-section">
    <!-- 产品信息卡片 -->
    <div class="product-card">
      <div class="product-card-logo">
        <img src="/logo.svg" alt="Logo" width="40" height="40" />
      </div>
      <div class="product-card-info">
        <div class="product-card-name">ALOCS-1688 采购助手</div>
        <div class="product-card-meta">
          <span>发布新的版本更新</span>
        </div>
      </div>
    </div>

    <!-- 编辑器布局 -->
    <div class="editor-layout">
      <!-- 左侧表单 -->
      <div class="editor-sidebar">
        <div class="editor-sidebar-title">版本信息</div>

        <div class="form-group">
          <label class="form-label">版本号</label>
          <input class="form-input" v-model="version" type="text" placeholder="例如：1.0.0" />
        </div>

        <div class="form-group">
          <label class="form-label">更新标题</label>
          <input class="form-input" v-model="title" type="text" placeholder="例如：正式发布" />
        </div>

        <div class="form-group">
          <label class="form-label">状态</label>
          <div class="form-hint">
            <span class="hint-dot published"></span>
            <span>发布后可见于用户端</span>
          </div>
        </div>
      </div>

      <!-- 右侧内容区 -->
      <div class="editor-main">
        <div class="editor-header">
          <span class="editor-label">更新内容</span>
          <span class="editor-hint">每行一条更新记录</span>
        </div>
        
        <textarea 
          class="editor-textarea"
          v-model="content" 
          placeholder="请输入更新内容，每行一条..."
          rows="12"
        ></textarea>

        <div class="editor-actions">
          <button class="btn-sm" @click="saveDraft">保存草稿</button>
          <button class="btn-sm" @click="preview">预览</button>
          <button class="btn-sm primary" @click="publish">发布</button>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="showPreview" class="preview-overlay" @click="showPreview = false">
      <div class="preview-panel" @click.stop>
        <h3>预览</h3>
        <div class="preview-version-label">v{{ version }} {{ title }}</div>
        <div class="preview-content" v-html="previewContent"></div>
        <div class="preview-close">
          <button class="btn-sm primary" @click="showPreview = false">关闭预览</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
:root {
  --brand-color: #3b82f6;
  --brand-hover: #2563eb;
  --brand-subtle: rgba(59,130,246,0.08);
  --ink-primary: #1f2937;
  --ink-secondary: #4b5563;
  --ink-tertiary: #9ca3af;
  --surface-bg: #f9fafb;
  --surface-card: #ffffff;
  --border-light: #e5e7eb;
  --border-medium: #d1d5db;
  --green: #10b981;
  --green-bg: #d1fae5;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 10px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.05);
}

.app-section {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.product-card {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 24px 28px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.product-card-logo {
  width: 56px;
  height: 56px;
  background: var(--brand-subtle);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.product-card-logo img {
  opacity: 0.85;
}

.product-card-info {
  flex: 1;
}

.product-card-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink-primary);
  margin-bottom: 4px;
  letter-spacing: -0.2px;
}

.product-card-meta {
  font-size: 13px;
  color: var(--ink-tertiary);
}

.editor-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 18px;
  align-items: start;
}

.editor-sidebar {
  background: var(--surface-card);
  border-radius: var(--radius-md);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  position: sticky;
  top: 24px;
}

.editor-sidebar-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-secondary);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-family: inherit;
  color: var(--ink-primary);
  transition: border-color 150ms ease, box-shadow 150ms ease;
  background: var(--surface-bg);
  outline: none;
}

.form-input:focus {
  border-color: var(--brand-color);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  background: var(--surface-card);
}

.form-input::placeholder {
  color: var(--ink-tertiary);
}

.form-hint {
  font-size: 12px;
  color: var(--ink-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.hint-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.hint-dot.published {
  background: var(--green);
}

.editor-main {
  background: var(--surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  padding: 20px;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.editor-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-secondary);
}

.editor-hint {
  font-size: 12px;
  color: var(--ink-tertiary);
}

.editor-textarea {
  width: 100%;
  padding: 12px;
  font-size: 13px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-family: inherit;
  color: var(--ink-primary);
  background: var(--surface-bg);
  resize: vertical;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
  line-height: 1.6;
}

.editor-textarea:focus {
  border-color: var(--brand-color);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  background: var(--surface-card);
}

.editor-textarea::placeholder {
  color: var(--ink-tertiary);
}

.editor-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.btn-sm {
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid var(--border-medium);
  background: var(--surface-card);
  color: var(--ink-secondary);
  font-family: inherit;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-sm:hover {
  border-color: var(--brand-color);
  color: var(--brand-color);
}

.btn-sm.primary {
  background: var(--brand-color);
  color: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(59,130,246,0.25);
}

.btn-sm.primary:hover {
  background: var(--brand-hover);
  box-shadow: 0 3px 12px rgba(59,130,246,0.35);
  transform: translateY(-1px);
}

.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.preview-panel {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
}

.preview-panel h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-primary);
  margin-bottom: 16px;
}

.preview-version-label {
  font-size: 16px;
  font-weight: 700;
  color: var(--brand-color);
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.preview-content {
  font-size: 14px;
  color: var(--ink-secondary);
  line-height: 1.8;
}

.preview-content ul {
  list-style: none;
  padding: 0;
}

.preview-content li {
  position: relative;
  padding-left: 16px;
  margin-bottom: 6px;
}

.preview-content li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--border-medium);
}

.preview-close {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 700px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
  
  .product-card {
    flex-direction: column;
    text-align: center;
  }
}
</style>
