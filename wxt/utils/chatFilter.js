// chatFilter.js — 聊天记录预处理
// AI 分析前先剔除系统提示、自动回复、寒暄、重复广告等低信息量内容，
// 只把有业务价值的对话交给模型，既省 token 也减少干扰。
// 原始记录不改动，过滤只发生在「读取用于分析」这一层。

const SYSTEM_RE = /(撤回了一条消息|开启了消息漫游|以上是(打招呼|历史)内容|现在可以开始聊天|对方正在输入|消息已读|系统消息|系统通知|该会话已结束|会话已关闭|您已添加|已添加好友|该消息已被删除|该用户已注销)/

// 平台自动回复 / 客服模板：只拦短模板，长的自动回复可能含业务信息（保留）
const AUTO_RE = /(自动回复|机器人|智能助手|客服助手|旺旺助手|千牛自动|欢迎光临|很高兴为您服务|您已进入|客服不在线|客服繁忙|请留言|稍后回复|非工作时间)/

// 纯寒暄 /  Acknowledgement
const GREETING_RE = /^(你好|您好|在吗|在么|在不在|亲|哈喽|hello|hi|嗯+|哦+|好的?|行的?|收到|谢谢|多谢|ok|okay|👌|🙏|[\s，。！!？?~～、]+)+$/i

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function hasMedia(m) {
  return (m.images || []).length > 0
}
function hasLink(m) {
  return (m.links || []).length > 0
}

// 逐条分类，返回保留的对话 + 各类噪音计数（不做截断）
export function classifyChat(messages) {
  const list = (messages || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))
  const stats = { total: list.length, kept: 0, filtered: 0, system: 0, auto: 0, greeting: 0, short: 0, duplicate: 0, empty: 0 }
  const kept = []
  const textCount = new Map()
  let prevText = ''
  for (const m of list) {
    const text = normalizeText(m.text)
    const media = hasMedia(m)
    const link = hasLink(m)
    let reason = ''
    if (!text && !media && !link) {
      reason = 'empty'
    } else if (text && SYSTEM_RE.test(text)) {
      reason = 'system'
    } else if (text && text.length <= 40 && AUTO_RE.test(text)) {
      reason = 'auto'
    } else if (text && text.length <= 12 && GREETING_RE.test(text)) {
      reason = 'greeting'
    } else if (text && text.length <= 2 && !/[\u4e00-\u9fa5]/.test(text) && !/\d/.test(text) && !media && !link) {
      // 只滤纯符号/表情的短内容；「没有」「可以」「有」这类中文短回复就是有效答复，不能丢
      reason = 'short'
    } else if (text && text === prevText) {
      // 同一句紧邻重复（自动回复常见）
      reason = 'duplicate'
    } else if (text) {
      const n = (textCount.get(text) || 0) + 1
      textCount.set(text, n)
      if (n >= 4) reason = 'duplicate' // 同一句话出现 4 次以上视为群发/模板
    }
    if (reason) {
      stats[reason]++
      stats.filtered++
      continue
    }
    kept.push(m)
    stats.kept++
    prevText = text
  }
  return { messages: kept, stats }
}

// 取最近 N 条且总字数不超过 maxChars（优先保留新对话）
function capMessages(messages, maxMessages, maxChars) {
  const recent = messages.slice(-maxMessages)
  const out = []
  let chars = 0
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]
    const len = (m.text || '').length + 20
    if (out.length && chars + len > maxChars) break
    chars += len
    out.unshift(m)
  }
  return out
}

export function filterChatForAi(messages, { maxMessages = 300, maxChars = 12000 } = {}) {
  const { messages: cleaned, stats } = classifyChat(messages)
  const capped = capMessages(cleaned, maxMessages, maxChars)
  return { messages: capped, stats }
}

function fmtTs(ts) {
  const d = new Date(ts || 0)
  if (!Number.isFinite(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 转成模型易读的对话文本
export function formatChatTranscript(messages, supplierLabel = '供应商') {
  return (messages || []).map(m => {
    const who = m.sender === 'me' ? '我' : supplierLabel
    let body = normalizeText(m.text)
    const tags = []
    if ((m.images || []).length) tags.push(`图片×${m.images.length}`)
    const offerIds = [...new Set((m.links || []).map(l => l.offer_id).filter(Boolean))]
    if (offerIds.length) tags.push(`商品卡片 ${offerIds.slice(0, 2).join('、')}`)
    if (!body) body = tags.length ? `[${tags.join('，')}]` : ''
    else if (tags.length) body += `（${tags.join('，')}）`
    return `[${fmtTs(m.ts)}] ${who}：${body}`
  }).join('\n')
}
