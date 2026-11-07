// factoryInfo.js — 旺旺「档案」工厂信息的归一化工具
// 档案里字段因供应商而异（生产厂家/贸易公司、有无认证、有无 BSR 指标都不同），
// 这里统一做三件事：字段分组（前端展示）、数值解析与分档（筛选选项）、搜索文本拼装。
// 纯函数，无浏览器 API —— localapi（background）与页面都可直接引用。

/** 已知字段的分组顺序（未列出的字段归入「其他信息」，保持档案原始顺序） */
export const INFO_GROUPS = [
  { key: 'basic', label: '基础信息', fields: ['经营模式', '交易方式', '成立日期', '主营信息'] },
  { key: 'factory', label: '工厂实力', fields: ['厂房面积', '员工人数', '生产档期', '加工定制', '认证信息'] },
  { key: 'service', label: '服务指标', fields: ['货描相符', '响应速度', '发货速度', '回头率'] },
]

/** 富文本 → 纯文本（备注搜索用） */
export function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 搜索文本归一：小写 + 去多余空白 */
export function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** 多段文本拼成可搜索的一整串（跳过空值） */
export function joinSearch(parts) {
  return normalizeText((parts || []).filter(Boolean).join(' \u0001 '))
}

/** 关键词匹配：按空格分词，全部命中才算命中（支持「ABS 塑料」这类多词查询） */
export function matchSearch(blob, keyword) {
  const kw = normalizeText(keyword)
  if (!kw) return true
  const text = String(blob || '')
  return kw.split(/\s+/).filter(Boolean).every(t => text.includes(t))
}

/**
 * 档案字段分组：
 * 返回 [{ key, label, rows: [{ key, value }] }]，只保留有值的分组。
 * 未在 INFO_GROUPS 中登记的字段按档案原顺序追加到「其他信息」。
 */
export function groupFactoryInfo(info) {
  const src = info && typeof info === 'object' ? info : {}
  const used = new Set()
  const out = []

  for (const g of INFO_GROUPS) {
    const rows = []
    for (const field of g.fields) {
      const v = src[field]
      if (v === undefined || v === null || String(v).trim() === '') continue
      rows.push({ key: field, value: String(v).trim() })
      used.add(field)
    }
    if (rows.length) out.push({ key: g.key, label: g.label, rows })
  }

  const others = Object.keys(src)
    .filter(k => !used.has(k))
    .map(k => ({ key: k, value: String(src[k] ?? '').trim() }))
    .filter(r => r.value)
  if (others.length) out.push({ key: 'others', label: '其他信息', rows: others })

  return out
}

/** 档案字段总数（判断「有没有工厂信息」用） */
export function countFactoryFields(info) {
  return groupFactoryInfo(info).reduce((n, g) => n + g.rows.length, 0)
}

/**
 * 从文本里取一个代表数值：支持「1.9万」「1900㎡」「10-50人」「约 100 人」
 * 区间取上界（产能/规模按上限估更稳妥），无数字返回 null
 */
export function parseNumber(text) {
  const s = String(text || '').replace(/,/g, '')
  if (!s) return null
  const wan = s.match(/(\d+(?:\.\d+)?)\s*万/)
  if (wan) return Math.round(parseFloat(wan[1]) * 10000)
  const nums = s.match(/\d+(?:\.\d+)?/g)
  if (!nums || !nums.length) return null
  return Math.max(...nums.map(n => parseFloat(n)))
}

/** 厂房面积分档 */
export const AREA_BUCKETS = [
  { value: 'lt500', label: '500㎡ 以下', test: n => n < 500 },
  { value: '500-1000', label: '500–1000㎡', test: n => n >= 500 && n < 1000 },
  { value: '1000-3000', label: '1000–3000㎡', test: n => n >= 1000 && n < 3000 },
  { value: 'gt3000', label: '3000㎡ 以上', test: n => n >= 3000 },
]

/** 员工人数分档 */
export const EMP_BUCKETS = [
  { value: 'lt50', label: '50 人以下', test: n => n < 50 },
  { value: '50-100', label: '50–100 人', test: n => n >= 50 && n < 100 },
  { value: '100-300', label: '100–300 人', test: n => n >= 100 && n < 300 },
  { value: 'gt300', label: '300 人以上', test: n => n >= 300 },
]

function bucketOf(buckets, text) {
  const n = parseNumber(text)
  if (n === null) return ''
  const hit = buckets.find(b => b.test(n))
  return hit ? hit.value : ''
}

export function areaBucket(text) { return bucketOf(AREA_BUCKETS, text) }
export function employeeBucket(text) { return bucketOf(EMP_BUCKETS, text) }

/** 档案更新时间格式化（后台/客服页共用） */
export function fmtProfileTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const p = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
