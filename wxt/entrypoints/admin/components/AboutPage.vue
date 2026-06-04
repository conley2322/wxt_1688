<script setup>
import { ref, onMounted } from 'vue'
import { MoreFilled, Box, User, Calendar, Check, Message } from '@element-plus/icons-vue'
import { api } from './useApi.js'

const version = '1.0.0'
const productName = 'ALOCS-1688 采购助手'
const producer = 'Conley'

const updates = ref([])

onMounted(async () => {
  try {
    const res = await api('/api/v1/updates', 'GET')
    if (res.code === 200) {
      updates.value = res.data
    }
  } catch (e) {
    console.error('加载更新日志失败:', e)
    // Mock data for demo
    updates.value = [
      {
        id: 1,
        version: '1.0.0',
        title: '正式发布',
        content: '<ul><li>新增商品管理瀑布流视图</li><li>支持评论图片点击放大查看</li><li>优化搜索筛选功能</li><li>修复若干已知问题</li></ul>',
        status: 'published',
        created_at: '2026-06-04 10:00'
      },
      {
        id: 2,
        version: '0.9.0',
        title: '测试版本',
        content: '<ul><li>实现商品评论功能</li><li>添加标签系统</li><li>创建浏览记录</li></ul>',
        status: 'published',
        created_at: '2026-05-20 15:30'
      },
      {
        id: 3,
        version: '0.8.0',
        title: '基础功能',
        content: '<ul><li>用户登录注册</li><li>商品数据采集</li><li>供应商管理</li></ul>',
        status: 'published',
        created_at: '2026-05-01 09:00'
      }
    ]
  }
})

function getStatusIcon(status) {
  return status === 'published' ? Check : Message
}

function getStatusColor(status) {
  return status === 'published' ? '#0bbd87' : '#f56c6c'
}

function getStatusText(status) {
  return status === 'published' ? '已发布' : '开发中'
}
</script>

<template>
  <section class="about-page">
    <!-- 产品信息卡片 -->
    <el-card class="info-card">
      <div class="info-header">
        <div class="logo">
          <el-icon :size="48"><Box /></el-icon>
        </div>
        <div class="info-content">
          <h1 class="product-name">{{ productName }}</h1>
          <p class="product-version">版本号：v{{ version }}</p>
          <p class="producer">
            <el-icon :size="16"><User /></el-icon>
            制作人：{{ producer }}
          </p>
        </div>
      </div>
      
      <el-divider />
      
      <div class="info-desc">
        <p>一款基于浏览器扩展的1688采购助手工具，帮助用户更高效地管理商品信息、评论和标签。</p>
      </div>
    </el-card>

    <!-- 更新日志时间线 -->
    <el-card class="timeline-card">
      <h2 class="section-title">
        <el-icon><Calendar /></el-icon>
        产品更新日志
      </h2>
      
      <el-timeline>
        <el-timeline-item
          v-for="(update, index) in updates"
          :key="update.id"
          :icon="getStatusIcon(update.status)"
          :color="getStatusColor(update.status)"
          :size="index === 0 ? 'large' : 'normal'"
          :timestamp="update.created_at"
        >
          <div class="timeline-header">
            <span class="version-badge">v{{ update.version }}</span>
            <span class="update-title">{{ update.title }}</span>
            <span :class="['status-tag', update.status]">{{ getStatusText(update.status) }}</span>
          </div>
          <div class="timeline-content" v-html="update.content"></div>
        </el-timeline-item>
      </el-timeline>
      
      <div v-if="updates.length === 0" class="empty-state">
        <el-empty description="暂无更新记录" />
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.about-page {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 30px;
}

.info-card {
  margin-bottom: 20px;
}

.info-header {
  display: flex;
  gap: 20px;
  align-items: center;
}

.logo {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.info-content {
  flex: 1;
}

.product-name {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px;
}

.product-version {
  font-size: 14px;
  color: #606266;
  margin: 0 0 4px;
}

.producer {
  font-size: 13px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-desc {
  color: #606266;
  line-height: 1.6;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.version-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.update-title {
  font-weight: 600;
  color: #303133;
}

.status-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  
  &.published {
    background: #e8f5e9;
    color: #27ae60;
  }
  
  &.draft {
    background: #fff3e0;
    color: #e67e22;
  }
}

.timeline-content {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.timeline-content :deep(ul) {
  padding-left: 20px;
  margin: 4px 0;
}

.timeline-content :deep(li) {
  margin: 4px 0;
}

.empty-state {
  padding: 40px 0;
}
</style>
