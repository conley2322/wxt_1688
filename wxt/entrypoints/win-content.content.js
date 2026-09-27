// entrypoints/win-content.content.js — 单机版：无需登录，直接注入协作浮窗
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import router from '../entrypoints/win/router.js'
import App from '../entrypoints/win/App.vue'

// 净化链接：去掉 query/hash，并在页面右侧注入"复制干净链接"悬浮按钮
async function setupCleanUrl() {
  // 进入即清理
  if (location.search || location.hash) {
    history.replaceState(null, '', location.pathname)
  }

  const mount = () => {
    if (document.getElementById('__alocs_copy_link_btn')) return
    const btn = document.createElement('div')
    btn.id = '__alocs_copy_link_btn'
    btn.title = '复制干净链接'
    btn.style.cssText = [
      'position:fixed', 'right:16px', 'top:50%', 'transform:translateY(-50%)',
      'width:40px', 'height:40px', 'border-radius:50%', 'background:#ff6a00',
      'box-shadow:0 2px 10px rgba(0,0,0,.2)', 'display:flex', 'align-items:center',
      'justify-content:center', 'cursor:pointer', 'z-index:2147483646',
      'transition:background .2s',
    ].join(';')
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
      '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' +
      '</svg>'
    btn.onmouseenter = () => { btn.style.background = '#e55f00' }
    btn.onmouseleave = () => { btn.style.background = '#ff6a00' }
    btn.onclick = async () => {
      const url = location.origin + location.pathname
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      showToast('链接已复制')
    }
    document.body.appendChild(btn)
  }

  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount, { once: true })
}

function showToast(text) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = [
    'position:fixed', 'right:66px', 'top:50%', 'transform:translateY(-50%)',
    'background:rgba(0,0,0,.75)', 'color:#fff', 'font-size:12px',
    'padding:6px 12px', 'border-radius:6px', 'z-index:2147483647',
    'pointer-events:none',
  ].join(';')
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1500)
}

export default defineContentScript({
  matches: ['*://detail.1688.com/offer/*'],
  async main(ctx) {
    try {
      const stored = await browser.storage.local.get('appSettings')
      if (stored.appSettings?.enableCleanUrl !== false) {
        await setupCleanUrl()
      }
    } catch (e) {
      console.warn('[win-content] 净化链接设置读取失败', e)
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
