
import { createApp } from 'vue'
import App from '../entrypoints/box/App.vue'

export default defineContentScript({
  matches: ['*://s.1688.com/selloffer/*'],

  main() {
    const render = (parentSelector, childSelector) => {
      const selector = `${parentSelector} ${childSelector}`
      document.querySelectorAll(selector).forEach((item) => {
        if (item.dataset.rendered) return
        item.dataset.rendered = 'true'

        const container = document.createElement('div')
        item.appendChild(container)
        const app = createApp(App, {
          parentEl: item,
        })
        app.mount(container)

        requestAnimationFrame(() => {
          if (!container.isConnected) return
          const parent = container.parentNode
          while (container.firstChild) {
            parent.insertBefore(container.firstChild, container)
          }
          parent.removeChild(container)
        })
      })
    }

    const renderAll = () => {
      render('.feeds-wrapper', '> a')
      render('[class*="offerListLayoutWrapper"]', '[class*="searchOfferWrapper"]')
    }

    renderAll()

    new MutationObserver(() => setTimeout(renderAll, 100))
      .observe(document.body, { childList: true, subtree: true })
  },
})
