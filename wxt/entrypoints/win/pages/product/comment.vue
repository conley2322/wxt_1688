<script setup>
import { useApiStore } from '@/stores/api/api.js'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'
import OthersComments from '@/entrypoints/win/components/OthersComments.vue'

const store = useApiStore()
</script>

<template>
  <div class="comment-page">
    <CommentInput
      v-if="store.currentOfferId"
      :key="store.currentOfferId"
      kind="product"
      :target="String(store.currentOfferId)"
    />
    <div class="others-wrap">
      <OthersComments
        v-if="store.currentOfferId"
        :key="'others-' + store.currentOfferId"
        kind="product"
        :target="String(store.currentOfferId)"
      />
    </div>
  </div>
</template>

<style scoped>
.comment-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
/* 他人笔记区：占满剩余高度并可滚动，左右间距与上方编辑器对齐 */
.others-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 12px;
}
</style>
