import { createRouter, createMemoryHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/product/comment' },
  {
    path: '/product/comment',
    name: 'product-comment',
    component: () => import('./pages/product/comment.vue'),
  },
  {
    path: '/product/tag',
    name: 'product-tag',
    component: () => import('./pages/product/tag.vue'),
  },
  {
    path: '/supplier/comment',
    name: 'supplier-comment',
    component: () => import('./pages/supplier/comment.vue'),
  },
  {
    path: '/supplier/tag',
    name: 'supplier-tag',
    component: () => import('./pages/supplier/tag.vue'),
  },
  {
    path: '/analysis/views',
    name: 'analysis-views',
    component: () => import('./pages/analysis/views.vue'),
  },
  {
    path: '/analysis/records',
    name: 'analysis-records',
    component: () => import('./pages/analysis/records.vue'),
  },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router