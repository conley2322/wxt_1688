<script setup>
import { useApiStore } from '@/stores/api/api.js'
import CommentInput from '@/entrypoints/win/components/CommentInput.vue'

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
  </div>
</template>

<style scoped>
.comment-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
