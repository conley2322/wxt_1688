import { reactive } from 'vue'
import { defineStore } from 'pinia'

export const useDomStore = defineStore('dom', () => {
  const dom = reactive({
    title: '默认标题',
    isLoginPage: true,
  });

  // 从页面提取 1688 会员 ID
  function extractMemberId() {
    try {
      // 从 offer 详情页的 data 属性提取
      const el = document.querySelector('[data-offer-id]')
      if (el) {
        const memberId = el.getAttribute('data-member-id') || el.getAttribute('data-memberid')
        if (memberId) return memberId
      }
      // 从 URL 参数提取
      const urlParams = new URLSearchParams(window.location.search)
      const fromUrl = urlParams.get('memberId') || urlParams.get('member_id')
      if (fromUrl) return fromUrl
      // 从页面 script 中提取
      const scripts = document.querySelectorAll('script')
      for (const s of scripts) {
        const match = s.textContent?.match(/["']memberId["']\s*:\s*["']([^"']+)["']/)
        if (match) return match[1]
      }
    } catch { }
    return ''
  }

  // 从页面内嵌 JSON 提取公司名（React 详情页 DOM 选择器不稳定，内嵌数据最可靠）
  // 详情页是客户端渲染，#shopNavigation 等只是 JSON 结构描述、未必有对应静态 DOM；
  // 而公司名稳定存在于启动脚本的 companyName / authCompanyName 字段。
  // 取首个 companyName（主商品卖家），与找工厂卡片标题同为干净全称，trim 后即可对齐。
  function extractCompanyName() {
    try {
      const scripts = document.querySelectorAll('script')
      for (const s of scripts) {
        const txt = s.textContent || ''
        if (!txt.includes('companyName')) continue
        const m = txt.match(/["']companyName["']\s*:\s*["']([^"']+)["']/)
          || txt.match(/["']authCompanyName["']\s*:\s*["']([^"']+)["']/)
        if (m && m[1]) return m[1].trim()
      }
    } catch { }
    return ''
  }

  async function get_dom_all_data() {
    console.log('get_dom_all_data: 开始 获取页面数据');
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

      const CompanyNames = extractCompanyName()
        || archiveOrdinaryFactoryName?.innerText
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

      // 取元素文本第一行非空行（容器型节点的 innerText 会带「商品库存高稳定」等噪音行）
      const firstLine = el => {
        if (!el) return ''
        const line = String(el.innerText || '').split('\n').map(s => s.trim()).filter(Boolean)[0]
        return line || ''
      }
      const titles = firstLine(document.querySelector('#productTitle > div > div.title-content > h1'))
        || firstLine(document.querySelector('#root-container .title-text'))
        // 新版页面 #productTitle 还在、内层结构变了的兜底（2026-11-14 实测 type-c 页全选择器失配）
        || firstLine(document.querySelector('#productTitle'))
        // 页面改版兜底：部分版本无 og:title；document.title 形如「商品名 - 阿里巴巴」——
        // 只剥站点后缀，不能 split('-')（标题本身含连字符，type-c 会被截成 "type"）
        || document.querySelector('meta[property="og:title"]')?.content
        || (document.title || '').replace(/\s*[-–—]\s*(阿里巴巴|1688\.com|alibaba\.com)\s*$/i, '').trim()
        || ''

      // 安全获取图片URL
      let imageUrl = ''
      try {
        const galleryList = document.querySelectorAll('.od-gallery-list li')
        const galleryList1 = document.querySelector('.od-gallery-list li img')
        console.log('galleryList1:', galleryList1)
        if (galleryList1) {
          imageUrl = galleryList1?.src || ''
          console.log('imageUrl:', imageUrl)
        } else if (galleryList.length > 1 && galleryList[1]) {
          const img = galleryList[1].querySelector('img')
          imageUrl = img?.src || ''
        } else if (!imageUrl) {
          const detailGallery = document.querySelectorAll('#root-container .detail-gallery-turn-wrapper')
          if (detailGallery.length > 1 && detailGallery[1]) {
            const img = detailGallery[1].querySelector('img')
            imageUrl = img?.src || ''
          }
        }
      } catch (err) {
        console.warn('获取图片URL时出错:', err)
      }
      // 主图兜底：og:image（改版页面选择器抓不到时）
      if (!imageUrl) {
        try { imageUrl = document.querySelector('meta[property="og:image"]')?.content || '' } catch {}
      }

      return {
        CompanyName: (CompanyNames || '').trim(),
        CompanyAddress: CompanyAddress1 || '',
        title: titles || '',
        imageUrl: imageUrl || '',
        productId: (window.location.href.match(/offer\/(\d+)\.html/)?.[1] ?? null) || '',
        memberId: extractMemberId() || '',
      }
    } catch (error) {
      console.error('获取 DOM 元素失败:', error)
      return {
        CompanyName: '',
        CompanyAddress: '',
        title: '',
        imageUrl: '',
        productId: (window.location.href.match(/offer\/(\d+)\.html/)?.[1] ?? null) || '',
        memberId: extractMemberId() || '',
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