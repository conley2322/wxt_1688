import { reactive } from 'vue'
import { defineStore } from 'pinia'

export const useDomStore = defineStore('dom', () => {
  const dom = reactive({
    title: '默认标题',
    isLoginPage: true,
  });

  async function get_dom_all_data() {
    try {
      // 工厂档案：普通工厂
      const archiveOrdinaryFactoryName = document.querySelector('#pc_card_baseinfo > div > div > div:nth-child(2) > div:nth-child(1) > div:nth-child(1)')
      const archiveOrdinaryFactoryAddress = document.querySelector('#pc_card_baseinfo > div > div > div:nth-child(2) > div:nth-child(4) > a > span:nth-child(2)')
      const archiveOrdinaryFactoryAddress1 = document.querySelector('#bd_0_container_0 > div > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(5) > div:nth-child(2) > div:nth-child(2)')
      const archiveOrdinaryFactoryAddress2 = document.querySelector('#bd_0_container_0 > div > div.module-wrapper > div:nth-child(1) > div:nth-child(3) > div:nth-child(4) > div:nth-child(2)')
      const archiveOrdinaryFactoryAddress3 = document.querySelector('#ft_0_container_0 > div > div:nth-child(2) > div > p:nth-child(1) > span:nth-child(2)')

      // 工厂档案：超级工厂
      const archivesuperFactoryName = document.querySelector('#pc_card_baseinfo > div > div:nth-child(1) > div:nth-child(2) > div > div:nth-child(1)')
      const archivesuperFactoryAddress = document.querySelector('#pc_card_baseinfo > div > div:nth-child(2) > div:nth-child(3) > a > span:nth-child(2)')

      // 工厂首页
      const homesuperFactoryName = document.querySelector('#hd_0_container_0 > div:nth-child(1) > div:nth-child(2) > div > div > div:nth-child(1) > div:nth-child(2) > div > div:nth-child(1) > span')
      const homesuperFactoryName2 = document.querySelector('#hd_0_container_0 > div:nth-child(1) > div:nth-child(2) > div > div > div:nth-child(1) > div:nth-child(3) > div > div:nth-child(1) > span')

      // 商品页面
      const archiveOrdinaryFactoryName1 = document.querySelector('#shopNavigation > div > div > div.winport-title.v-flex > a.shop-company-name.v-flex.shop-name-wrapper > h1')
      const archiveOrdinaryFactoryName2 = document.querySelector('#shopNavigation > div > a > div.winport-title.v-flex > a.shop-company-name.v-flex h1')

      const CompanyNames = archiveOrdinaryFactoryName?.innerText
        || archivesuperFactoryName?.innerText
        || homesuperFactoryName?.innerText
        || archiveOrdinaryFactoryName1?.innerText
        || homesuperFactoryName2?.innerText
        || archiveOrdinaryFactoryName2?.innerText
      const CompanyAddress1 = archiveOrdinaryFactoryAddress?.innerText
        || archivesuperFactoryAddress?.innerText
        || archiveOrdinaryFactoryAddress1?.innerText
        || archiveOrdinaryFactoryAddress2?.innerText
        || archiveOrdinaryFactoryAddress3?.innerText

      const titles = document.querySelector('#productTitle > div > div.title-content > h1')?.innerText
        || document.querySelector('#root-container .title-text')?.innerText
        || ''

      // 安全获取图片URL
      let imageUrl = ''
      try {
        const galleryList = document.querySelectorAll('.od-gallery-list li')
        if (galleryList.length > 1 && galleryList[1]) {
          const img = galleryList[1].querySelector('img')
          imageUrl = img?.src || ''
        }
        if (!imageUrl) {
          const detailGallery = document.querySelectorAll('#root-container .detail-gallery-turn-wrapper')
          if (detailGallery.length > 1 && detailGallery[1]) {
            const img = detailGallery[1].querySelector('img')
            imageUrl = img?.src || ''
          }
        }
      } catch (err) {
        console.warn('获取图片URL时出错:', err)
      }

      return {
        CompanyName: CompanyNames || '',
        CompanyAddress: CompanyAddress1 || '',
        title: titles || '',
        imageUrl: imageUrl || '',
        productId: (window.location.href.match(/offer\/(\d+)\.html/)?.[1] ?? null) || '',
      }
    } catch (error) {
      console.error('获取 DOM 元素失败:', error)
      return {
        CompanyName: '',
        CompanyAddress: '',
        title: '',
        imageUrl: '',
        productId: (window.location.href.match(/offer\/(\d+)\.html/)?.[1] ?? null) || '',
      }
    }
  }

  function get_data_xu_ni() {
    return {
      CompanyName: '石狮市莫菲亚服装厂',
      CompanyAddress: '石狮市莫菲亚服装厂地址',
      title: '秋季新款男式PU皮衣男士西装皮夹克西服薄款休闲外套皮夹克男',
      imageUrl: 'https://quark-aistudio-cdn-v2.quark.cn/d%2Fzaodian%2Fbec54902ae288f75655d66664a9f4026%2F1768122209305-7dab0b08a2db48a996dc245f44fb00fc.png?auth_key=1771744920-0-0-7342a9d93aa314d64b6d59a9afd7f9c2&x-oss-process=image/format,webp/resize,w_512',
      productId: '773149563136',
    }
  }

  return {
    dom, get_dom_all_data, get_data_xu_ni
  }
})