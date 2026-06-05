<script setup>
function openProduct(offerId) {
  window.open(`https://detail.1688.com/offer/${offerId}.html`, '_blank')
}

defineProps({
  supplier: {
    type: Object,
    required: true,
    default: () => ({
      supplier_name: '',
      comments: [],
      products: [],
      comment_count: 0,
      product_count: 0,
    })
  }
})
</script>

<template>
  <el-card class="supplier-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <div class="supplier-name">
          <el-icon size="16"><component is="Shop" /></el-icon>
          {{ supplier.supplier_name }}
        </div>
        <div class="supplier-stats">
          <el-tag v-if="supplier.comment_count > 0" type="warning" size="small">
            {{ supplier.comment_count }} 条评论
          </el-tag>
          <el-tag type="info" size="small">
            {{ supplier.product_count }} 件商品
          </el-tag>
        </div>
      </div>
    </template>

    <!-- 评论区域 -->
    <div v-if="supplier.comments.length > 0" class="comment-section">
      <div class="section-label">我的留言</div>
      <div v-for="c in supplier.comments" :key="c.id" class="comment-item">
        <div class="comment-text" v-html="c.text"></div>
        <div class="comment-time">{{ c.created_at }}</div>
      </div>
    </div>

    <!-- 商品图片展示 -->
    <div v-if="supplier.products.length > 0" class="product-section">
      <div class="section-label">浏览过的商品</div>
      <div class="product-grid">
        <div
          v-for="p in supplier.products"
          :key="p.offer_id"
          class="product-item"
          :title="p.title"
          @click="openProduct(p.offer_id)"
        >
          <el-image
            v-if="p.main_img_url"
            :src="p.main_img_url"
            :alt="p.title"
            fit="cover"
            class="product-img"
            lazy
          >
            <template #error>
              <div class="img-placeholder">无图</div>
            </template>
          </el-image>
          <div v-else class="img-placeholder">无图</div>
          <div class="product-title">{{ p.title }}</div>
        </div>
      </div>
    </div>

    <el-empty v-if="supplier.products.length === 0 && supplier.comments.length === 0" description="暂无数据" :image-size="60" />
  </el-card>
</template>

<style scoped>
.supplier-card {
  margin-bottom: 16px;
  border-radius: 10px;
  border: none;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.supplier-name {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.supplier-stats {
  display: flex;
  gap: 6px;
}

/* 评论 */
.comment-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.comment-item {
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  border-radius: 0 6px 6px 0;
  padding: 10px 14px;
  margin-bottom: 8px;
}

.comment-text {
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
}

.comment-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

/* v-html 富文本内容样式 */
.comment-text :deep(p) { margin: 0 0 4px; }
.comment-text :deep(ul) { margin: 4px 0; padding-left: 18px; }
.comment-text :deep(ol) { margin: 4px 0; padding-left: 18px; }
.comment-text :deep(li) { margin-bottom: 2px; }
.comment-text :deep(strong) { font-weight: 600; color: #334155; }
.comment-text :deep(em) { font-style: italic; }
.comment-text :deep(blockquote) {
  margin: 6px 0;
  padding: 4px 12px;
  border-left: 3px solid #cbd5e1;
  color: #64748b;
}
.comment-text :deep(a) { color: #6366f1; }

/* 商品 */
.product-section {
  margin-bottom: 4px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}

.product-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
  border-radius: 6px;
  padding: 4px;
}
.product-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.product-item:hover .product-img {
  border-color: #6366f1;
}

.product-img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #e2e8f0;
}

.img-placeholder {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 11px;
  border: 1px solid #e2e8f0;
}

.product-title {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
