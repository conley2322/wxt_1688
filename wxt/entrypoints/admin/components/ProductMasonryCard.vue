<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { Picture, View, ChatDotRound } from '@element-plus/icons-vue'
import Viewer from 'viewerjs'
import 'viewerjs/dist/viewer.css'

const props = defineProps({
  product: { type: Object, required: true }
})

const emit = defineEmits(['click'])
const commentRef = ref(null)
let viewer = null

function productUrl(offerId) {
  return `https://detail.1688.com/offer/${offerId}.html`
}

function handleClick() {
  emit('click', props.product)
}

const hasMyComment = computed(() => props.product.my_comment && props.product.my_comment.trim())

function initViewer() {
  if (commentRef.value && !viewer) {
    viewer = new Viewer(commentRef.value, {
      inline: false,
      button: true,
      navbar: true,
      title: true,
      toolbar: true,
      movable: true,
      zoomable: true,
      rotatable: true,
      scalable: true,
      transition: true,
      fullscreen: true,
      keyboard: true
    })
  }
}

onMounted(() => {
  nextTick(() => {
    initViewer()
  })
})

watch(() => props.product.my_comment, () => {
  nextTick(() => {
    if (viewer) {
      viewer.destroy()
      viewer = null
    }
    initViewer()
  })
})
</script>

<template>
  <div class="masonry-card" @click="handleClick">
    <!-- 图片 -->
    <div class="card-img-wrap">
      <el-image
        v-if="product.main_img_url"
        :src="product.main_img_url"
        class="card-img"
        fit="cover"
      />
      <div v-else class="card-img-placeholder">
        <el-icon :size="32"><Picture /></el-icon>
      </div>
    </div>

    <!-- 标题 -->
    <a :href="productUrl(product.offer_id)" target="_blank" class="card-title" @click.stop>
      {{ product.title }}
    </a>

    <!-- 我的评论 -->
    <div v-if="hasMyComment" class="card-comment" ref="commentRef" v-html="product.my_comment"></div>

    <!-- 统计数据 -->
    <div class="card-stats">
      <span class="stat-item">
        <el-icon :size="12"><View /></el-icon>
        {{ product.view_count || 0 }}
      </span>
      <span class="stat-item">
        <el-icon :size="12"><ChatDotRound /></el-icon>
        {{ product.comment_count || 0 }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.masonry-card {
  break-inside: avoid;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #ebeef5;
  max-width: 200px;
  width: 100%;
}

.masonry-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card-img-wrap {
  width: 100%;
  position: relative;
}

.card-img {
  width: 100%;
  display: block;
}

.card-img-placeholder {
  width: 100%;
  height: 120px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}

.card-title {
  display: block;
  padding: 8px 10px 6px;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-title:hover {
  color: #c9975c;
}

.card-comment {
  padding: 0 10px 6px;
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
  word-break: break-word;
}

.card-comment :deep(ul),
.card-comment :deep(ol) {
  padding-left: 14px;
  margin: 2px 0;
}

.card-comment :deep(li) {
  margin: 2px 0;
}

.card-comment :deep(p) {
  margin: 2px 0;
}

.card-comment :deep(img) {
  max-width: 20%;
  height: auto;
  object-fit: contain;
}

.card-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px 8px;
  border-top: 1px solid #f5f7fa;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #909399;
}
</style>
