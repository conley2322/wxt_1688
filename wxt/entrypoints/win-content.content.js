// entrypoints/win-content.content.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import router from '../entrypoints/win/router.js'
import App from '../entrypoints/win/App.vue'

export default defineContentScript({
  matches: ['*://detail.1688.com/offer/*'],
  main(ctx) {
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const app = createApp(App)
        app.use(createPinia())
        app.use(router)
        app.use(ElementPlus, { locale: zhCn })
        app.mount(container)
        return app
      },
      onRemove: (app) => {
        app.unmount()
      },
    })
    ui.mount()
  },
})
