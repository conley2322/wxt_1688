<script setup>
import { ref } from 'vue'
import HsCard from './hs-card'
const props = defineProps(['parentEl'])
const activePanel = ref(0)
const viewMode = ref('product')
// 直接改父元素样式
if (props.parentEl) {
  props.parentEl.style.height = 'auto'
}
const href = props.parentEl.getAttribute('href');

const data_renderkey = props.parentEl.getAttribute('data-renderkey') || props.parentEl.getAttribute('data-renderkey');
const data_aplus = props.parentEl.getAttribute('data-aplus-report') || props.parentEl.getAttribute('data-aplus-report');
const link_element = props.parentEl.querySelector('a[href*="offerId="]') || props.parentEl;

const match_href = href?.match(/offerId=(\d+)/)?.[1];
const match_renderkey = data_renderkey?.match(/_(\d+)$/)?.[1];
const match_offerId = data_aplus?.match(/offerId@(\d+)/)?.[1];
const match_objectId = data_aplus?.match(/object_id@(\d+)/)?.[1];
const match_link_href = link_element?.href?.match(/offerId=(\d+)/)?.[1];

const offer_id = match_renderkey || match_href || match_offerId || match_objectId || match_link_href;
console.log('商品 id:', offer_id);
const cardData = ref({
  viewCount: 0,
  // product / factory 只保留静态展示字段（viewCount 等）
  // 动态数据（myComment、myTags、tags、comments、viewers）全部由 loader 拉取
  product: {},
  factory: {}
})
onMounted(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/v1/products/Product_get_box_info?offer_id=983629399634', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiIxIiwiaWF0IjoxNzgwMTA4NjcyLCJleHAiOjE3ODAxOTUwNzJ9.4ZPtmBY9aMPRTpf0uHbbfXZlCBGZxVwRJb_Mr8HtXsw`
      },
    })
    const data = await res.json()
    console.log(data)
    apiData.value = data
  } catch (error) {
    console.error('请求失败:', error)
  }
})
// 主视图数据（mount 时拉 product，切厂时拉 factory）
async function fetchView({ viewMode }) {
  await new Promise(r => setTimeout(r, 600)) // 替换为实际 API
  if (viewMode === 'product') {
    console.log('[请求] 商品视图数据')
    return {
      myComment: { text: '这个产品整体质量不错，性价比高，推荐给团队其他成员使用', date: '2024-03-15' },
      myTags: [{ text: '已收藏', date: '2024-03-10' }, { text: '重点关注', date: '2024-03-12' }],
      viewers: [{ name: '张三', tip: '张三 - 产品经理' }, { name: '李四', tip: '李四 - 设计师' }],
      tagCount: 4,
      commentCount: 3,
      viewCount: 213
    }
  }
  if (viewMode === 'factory') {
    console.log('[请求] 工厂视图数据')
    return {
      myComment: { text: '工厂产能稳定，交期准时，已经合作两年多了', date: '2024-03-14' },
      myTags: [{ text: '供应商', date: '2024-03-11' }],
      viewers: [{ name: '孙八', tip: '孙八 - 采购主管' }],
      tagCount: 2,
      commentCount: 2
    }
  }
}

// 标签面板懒加载
async function fetchTags({ viewMode }) {
  await new Promise(r => setTimeout(r, 600))
  const data = {
    tags: [
      { text: '热销', author: '张三', date: '2024-03-01' },
      { text: '新品', author: '李四', date: '2024-03-05' }
    ]
  }
  console.log('[懒加载-标签]', data)
  return data
}

// 评论面板懒加载
async function fetchComments({ viewMode }) {
  await new Promise(r => setTimeout(r, 600))
  const data = {
    comments: [
      { text: '用过之后感觉很好', author: '王五', date: '2024-03-08', color: '#3498db' },
      { text: '推荐购买', author: '赵六', date: '2024-03-10', color: '#2ecc71' }
    ]
  }
  console.log('[懒加载-评论]', data)
  return data
}
</script>
<template>
  <HsCard width="auto" :height="150" :data="cardData" :load="fetchView" :load-tags="fetchTags"
    :load-comments="fetchComments"></HsCard>
</template>