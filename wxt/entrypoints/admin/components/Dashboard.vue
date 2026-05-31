<script setup>
import { ref, onMounted } from 'vue'
import { api } from './useApi.js'

const userCount = ref(0)
const tagCount = ref(0)
const productCount = ref(0)

onMounted(async () => {
  console.log('[Dashboard] 挂载')
  try {
    const [u, t, p] = await Promise.all([
      api('/api/v1/users', 'GET'),
      api('/api/v1/tags/pool', 'GET'),
      api('/api/v1/products/mine', 'GET'),
    ])
    console.log('[Dashboard] 数据:', { users: u.code, tags: t.code, products: p.code })
    if (u.code === 200) userCount.value = (u.data || u).length
    if (t.code === 200) tagCount.value = t.data.length
    if (p.code === 200) productCount.value = p.total || p.data.length
  } catch (e) { console.error('[Dashboard] 加载失败:', e) }
})
</script>
<template>
  <section>
    <h2 class="page-title">概览</h2>
    <el-row :gutter="16">
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="用户总数" :value="userCount"><template #prefix><el-icon color="#c9975c"><User /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="标签总数" :value="tagCount"><template #prefix><el-icon color="#67c23a"><CollectionTag /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="浏览商品" :value="productCount"><template #prefix><el-icon color="#409eff"><Goods /></el-icon></template></el-statistic></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="系统状态" value="运行中"><template #prefix><el-icon color="#67c23a"><CircleCheck /></el-icon></template></el-statistic></el-card></el-col>
    </el-row>
  </section>
</template>
<style scoped>
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0 0 20px; }
</style>
