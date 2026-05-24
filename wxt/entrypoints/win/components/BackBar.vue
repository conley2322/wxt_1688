<template>
  <Teleport v-if="visible" :to="'.content-go-back'">
    <div class="back-bar">
      <div class="back-button" @click="goBack">
        <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
          <path d="M783.58 73.85L329.1 511.29l454.48 437.44c17.04 17.04 17.04 45.45 0 62.49s-39.77 17.04-56.81 0L238.2 545.38c-5.68-11.36-11.36-22.72-11.36-34.09 0-11.36 5.68-22.72 11.36-34.08L726.77 11.36c17.04-17.04 39.77-17.04 56.81 0 17.04 17.04 17.04 45.45 0 62.49z" />
        </svg>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  to: { type: String, required: true },
  visible: { type: Boolean, default: true },
})

const router = useRouter()
const goBack = () => router.push(props.to)
</script>

<style scoped>
.back-bar { height: auto; }
.back-button {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  color: #666;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}
.back-button:hover { color: #409eff; background: rgba(64,158,255,0.08); }
</style>