import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router.js'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia()) // 注册 Pinia 实例
app.use(router)

app.mount('#app')