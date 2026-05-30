import { createRouter, createMemoryHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/product' },
  {
    path: '/product',
    name: 'product',
    component: () => import('./pages/product/comment.vue'),
  },
  {
    path: '/supplier',
    name: 'supplier',
    component: () => import('./pages/supplier/comment.vue'),
  },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router
