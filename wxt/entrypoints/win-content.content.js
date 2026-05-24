// entrypoints/win-content.content.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
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
