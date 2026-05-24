<script setup>
</script>

<template>
  <div class="settings-page">
    <div class="section">
      <div class="section-title">关于</div>
      <div class="about-card">
        <div class="about-row">
          <span class="label">版本</span>
          <span class="val">1.0.0</span>
        </div>
        <div class="about-row">
          <span class="label">框架</span>
          <span class="val">WXT + Vue 3</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page { padding: 12px; }
.section { margin-bottom: 16px; }
.section-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px; }
.about-card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
}
.about-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px;
  font-size: 13px;
}
.about-row + .about-row { border-top: 1px solid #f8f8f8; }
.about-row .label { color: #999; }
.about-row .val { color: #333; font-weight: 500; }
</style>