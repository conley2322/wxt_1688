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
  async main(ctx) {
    // ── 检查登录状态 ──
    const stored = await browser.storage.local.get(['token'])
    if (!stored.token) {
      // 未登录，显示提示条
      if (!document.getElementById('__1688_login_tip__')) {
        const bar = document.createElement('div')
        bar.id = '__1688_login_tip__'
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff3cd;color:#856404;text-align:center;padding:8px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Arial,sans-serif;border-bottom:1px solid #ffc107;'
        bar.textContent = '⚠ 请先点击浏览器右上角的 1688 助手图标登录'
        document.body.prepend(bar)
      }
      return
    }

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
