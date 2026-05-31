<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

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

onMounted(async () => {
  console.log('[Settings] 挂载')
  const stored = await browser.storage.local.get(['boxDefault', 'serverAddress', 'toolbarConfig'])
  if (stored.boxDefault) boxDefault.value = stored.boxDefault
  if (stored.serverAddress) serverAddress.value = stored.serverAddress
  if (stored.toolbarConfig) Object.assign(toolbarConfig.value, stored.toolbarConfig)
  console.log('[Settings] 当前设置:', stored)
})

async function saveSettings() {
  console.log('[Settings] 保存:', { boxDefault: boxDefault.value, serverAddress: serverAddress.value, toolbarConfig: toolbarConfig.value })
  await browser.storage.local.set({
    boxDefault: boxDefault.value,
    serverAddress: serverAddress.value,
    toolbarConfig: toolbarConfig.value
  })
  ElMessage.success('已保存')
}
</script>
<template>
  <section>
    <h2 class="page-title">系统设置</h2>
    <el-card style="margin-bottom:16px">
      <template #header>基础设置</template>
      <el-form label-width="140px">
        <el-form-item label="服务器地址"><el-input v-model="serverAddress" placeholder="http://localhost:3000" /></el-form-item>
        <el-form-item label="Box 默认面板">
          <el-select v-model="boxDefault">
            <el-option label="商品信息" value="product" />
            <el-option label="供应商信息" value="supplier" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 富文本工具栏配置 -->
    <el-card>
      <template #header>评论编辑器工具栏 (wangEditor)</template>
      <el-form label-width="100px">
        <el-form-item label="工具栏按钮">
          <el-checkbox v-model="toolbarConfig.bold">加粗</el-checkbox>
          <el-checkbox v-model="toolbarConfig.italic">斜体</el-checkbox>
          <el-checkbox v-model="toolbarConfig.underline">下划线</el-checkbox>
          <el-checkbox v-model="toolbarConfig.strikethrough">删除线</el-checkbox>
          <el-checkbox v-model="toolbarConfig.heading">标题</el-checkbox>
          <el-checkbox v-model="toolbarConfig.bulletList">无序列表</el-checkbox>
          <el-checkbox v-model="toolbarConfig.orderedList">有序列表</el-checkbox>
          <el-checkbox v-model="toolbarConfig.blockquote">引用块</el-checkbox>
          <el-checkbox v-model="toolbarConfig.code">代码块</el-checkbox>
          <el-checkbox v-model="toolbarConfig.link">插入链接</el-checkbox>
          <el-checkbox v-model="toolbarConfig.image">插入图片</el-checkbox>
        </el-form-item>
        <el-form-item label="全屏按钮">
          <el-switch v-model="toolbarConfig.fullscreen" active-text="显示" inactive-text="隐藏" />
        </el-form-item>
      </el-form>
    </el-card>

    <div style="margin-top:16px">
      <el-button type="primary" @click="saveSettings">保存设置</el-button>
    </div>
  </section>
</template>
<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0 0 20px; }
</style>
