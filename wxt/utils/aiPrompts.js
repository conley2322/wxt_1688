// aiPrompts.js — 提示词拼装与结构化结果解析（管理后台 AI 分析共用）

export const ANALYSIS_JSON_INSTRUCTION = `请只输出一个 JSON 对象，不要输出 JSON 以外的任何文字，不要使用 Markdown 代码块。结构必须为：
{
  "summary": "一句话结论（80 字内）",
  "sections": [{ "title": "小标题", "items": ["要点1", "要点2"] }],
  "risks": ["风险或不确定点"],
  "next_actions": ["建议的下一步动作"]
}
要求：内容全部使用中文；只依据给定资料，不臆造价格、交期、认证等未出现的信息，缺失就写「资料未提及」；sections 给 4~6 组，每组 2~6 条；risks 与 next_actions 各 2~5 条。`

const SYSTEM_PROMPT = '你是资深 1688 采购分析师，擅长从供应商档案、商品浏览数据和旺旺聊天记录中提炼可执行结论。回答必须克制、具体、可核对。'

function fmtTime(ts) {
  if (!ts) return '无'
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime())) return '无'
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function archiveLines(archive) {
  const a = archive || {}
  const map = {
    '经营模式': a.model, '交易方式': a.trade, '认证信息': a.cert,
    '厂房面积': a.area, '员工人数': a.employees, '主营产品': a.products, '主营行业': a.industry, '诚信通年限': a.year,
  }
  const rows = []
  for (const [k, v] of Object.entries(map)) if (v) rows.push(`- ${k}：${v}`)
  return rows.length ? rows.join('\n') : '- 资料未提及'
}

// ── 单供应商分析 ──
function supplierDataBlock(ctx) {
  const t = ctx.totals || {}
  const productLines = (ctx.products || []).map(p =>
    `- ${p.title || '(无标题)'}｜浏览 ${p.view_count} 次｜最近 ${fmtTime(p.last_viewed_at)}${p.note ? `｜我的备注：${p.note}` : ''}`
  ).join('\n') || '- 暂无商品数据'
  const noteLines = (ctx.notes || []).map((n, i) => `${i + 1}. ${n}`).join('\n') || '- 暂无供应商备注'
  const transcript = ctx.transcript || '（无可用聊天记录）'
  const noise = ctx.noise || {}

  return `【供应商】${ctx.name}
【诚信通/登录 ID】${(ctx.login_ids || []).join('、') || '未知'}

【档案信息】
${archiveLines(ctx.archive)}

【数据概况】
- 商品数：${t.product_count || 0}
- 浏览次数：${t.view_count || 0}｜出现次数：${t.appear_count || 0}
- 首次浏览：${fmtTime(t.first_view_at)}｜最近浏览：${fmtTime(t.last_view_at)}
- 聊天记录：${t.chat_count || 0} 条（已过滤噪音 ${t.chat_filtered || 0} 条，实际分析 ${t.chat_kept || 0} 条）
- 首次沟通：${fmtTime(t.first_chat_at)}｜最近沟通：${fmtTime(t.last_chat_at)}

【商品与我的备注】
${productLines}

【我的供应商备注】
${noteLines}

【聊天记录摘要】${noise.total ? `（原始 ${noise.total} 条，过滤系统/自动回复/寒暄/重复 ${noise.filtered} 条）` : ''}
${transcript}`
}

export function buildSupplierPrompt(ctx) {
  const user = `请分析以下供应商（结合档案、商品浏览、我的备注和旺旺聊天记录），给出采购决策建议。

${supplierDataBlock(ctx)}

分析重点：1) 供应商实际经营范围与主营品类；2) 聊天中透露的价格、起订量、交期、定制/打样、物流能力；3) 我方关注点与对方响应态度；4) 资料缺口与风险；5) 下一步该怎么跟进（问什么、做什么）。

${ANALYSIS_JSON_INSTRUCTION}`

  return { system: SYSTEM_PROMPT, user }
}

// ── 单供应商对话（AI 分析页签的聊天形式）──
const CHAT_RULES = `你正在用对话方式帮采购员分析这家供应商，回答要像一位务实的采购同事：先给结论，再给依据。

规则：
1. 只依据下方资料回答；资料里没有的，明确说「资料未提及」，不要编造。
2. 引用价格、起订量、交期、面积、人数等数字时原样引用，不改写、不换算。
3. 关键结论标注来源：【档案】【商品】【我的备注】【聊天 MM-DD HH:mm】；由多条信息推断出的结论标注【推测】。
4. 档案与聊天冲突时并列写出双方说法，提示「建议核实」，不要自行选边。
5. 用简洁中文回答，可以分点，不要输出 JSON、表格或 Markdown 代码块。
6. 用户问的内容超出这家供应商的数据范围时，先说明，再给通用建议并标注【通用建议】。`

export function buildSupplierChatSystem(ctx) {
  return `${CHAT_RULES}

以下是这家供应商的全部可用资料（聊天记录已过滤系统提示、自动回复、寒暄和重复内容）：

${supplierDataBlock(ctx)}`
}

// ── 全局数据分析 ──
export function buildOverviewPrompt(ctx) {
  const t = ctx.totals || {}
  const n = ctx.chat_noise || {}
  const supplierLines = (ctx.suppliers || []).map((s, i) => {
    const a = s.archive || {}
    const bits = [a.model, a.trade, a.cert, a.employees].filter(Boolean).join(' / ')
    return `${i + 1}. ${s.name}｜商品 ${s.product_count}｜浏览 ${s.view_count}｜出现 ${s.appear_count}｜笔记 ${s.note_count}｜聊天 ${s.chat?.count || 0} 条（有效 ${s.chat?.kept ?? '-'}）｜最近互动 ${fmtTime(Math.max(s.last_view_at || 0, s.chat?.last_ts || 0))}${bits ? `｜${bits}` : ''}`
  }).join('\n') || '- 暂无供应商数据'

  const chatOnly = (ctx.chat_suppliers || [])
    .filter(c => !(ctx.suppliers || []).some(s => s.name === c.name))
    .slice(0, 10)
    .map(c => `- ${c.name}｜聊天 ${c.count} 条（有效 ${c.kept}）｜最近 ${fmtTime(c.last_ts)}`)
    .join('\n') || '- 无'

  const productLines = (ctx.products || []).map(p => `- ${p.title || '(无标题)'}｜${p.supplier_name || '未知供应商'}｜浏览 ${p.view_count} 次`).join('\n') || '- 暂无商品数据'

  const daily = (ctx.daily || []).filter(d => d.view || d.appear).map(d => `${d.date} 浏览${d.view}/出现${d.appear}`).join('；') || '近 30 天无浏览记录'
  const hourly = (ctx.hourly || []).map((v, h) => v ? `${h}点:${v}` : '').filter(Boolean).join('，') || '无'
  const dist = ctx.distributions || {}
  const distLines = [
    dist.model?.length ? `经营模式：${dist.model.map(x => `${x.value}(${x.count})`).join('、')}` : '',
    dist.trade?.length ? `交易方式：${dist.trade.map(x => `${x.value}(${x.count})`).join('、')}` : '',
    dist.cert?.length ? `认证信息：${dist.cert.map(x => `${x.value}(${x.count})`).join('、')}` : '',
  ].filter(Boolean).join('\n') || '- 无档案分布数据'

  const scope = ctx.scope || {}
  const user = `请基于以下本地采购数据做整体分析。注意：为控制规模，明细只提供了 TopN 和聚合结果（供应商 ${scope.suppliers_included}/${scope.suppliers_total}，商品 ${scope.products_included}/${scope.products_total}，聊天按每供应商最近记录取样），请在结论中说明这是抽样/聚合口径，不要假装看过了全部明细。

【总量】
- 供应商：${t.supplier_count || 0}（有档案 ${t.supplier_profile_count || 0}）
- 商品：${t.product_count || 0}（有浏览 ${t.viewed_product_count || 0}）
- 浏览：${t.view_count || 0}｜出现：${t.appear_count || 0}｜笔记：${t.note_count || 0}
- 聊天：${t.chat_count || 0} 条 / ${t.chat_supplier_count || 0} 个供应商；过滤系统/自动回复/寒暄/重复后有效 ${n.kept || 0} 条（过滤 ${n.filtered || 0}：系统 ${n.system || 0}、自动回复 ${n.auto || 0}、寒暄 ${n.greeting || 0}、短句 ${n.short || 0}、重复 ${n.duplicate || 0}）

【供应商 Top（按浏览）】
${supplierLines}

【仅聊天、无商品数据的供应商】
${chatOnly}

【商品 Top（按浏览）】
${productLines}

【近 30 天趋势】${daily}

【浏览时段分布】${hourly}

【档案分布】
${distLines}

分析重点：1) 当前供应商池的结构与集中度（是否过度依赖少数供应商）；2) 浏览偏好反映的选品方向；3) 已沟通但未沉淀商品/笔记的空白；4) 需要优先跟进的供应商及理由；5) 数据管理建议（该补什么、该清理什么）。引用具体供应商名称作为依据。

${ANALYSIS_JSON_INSTRUCTION}`

  return { system: SYSTEM_PROMPT, user }
}

// ── 定向检索问答（RAG）──
export function buildRetrievalPrompt(question, hits) {
  const hitLines = (hits || []).map((h, i) => {
    const a = h.archive || {}
    const bits = [a.model, a.trade, a.cert, a.employees, a.area].filter(Boolean).join(' / ')
    const snips = (h.snippets || []).map(s => `  · ${fmtTime(s.ts)} ${s.sender === 'me' ? '我' : '供应商'}：${s.text}`).join('\n')
    const products = (h.matched_products?.length ? h.matched_products : h.top_products || []).slice(0, 5)
      .map(x => `  · 商品：${x}`).join('\n')
    return `【${i + 1}. ${h.name}】商品 ${h.product_count}｜浏览 ${h.view_count}｜最近互动 ${fmtTime(Math.max(h.last_view_at || 0, h.last_chat_ts || 0))}${bits ? `｜${bits}` : ''}\n${snips || '  · 无命中聊天片段'}${products ? '\n' + products : ''}`
  }).join('\n\n') || '（未检索到相关供应商）'

  const user = `用户问题：${question}

以下是本地检索（BM25 + 中文二元分词）从全部供应商、商品标题和历史聊天中召回的片段，按相关度排序。请只据此回答，不要补充未出现的事实。

${hitLines}

回答要求：先直接回答用户问题；再按供应商归纳依据（引用供应商名称）；若召回信息不足以回答，明确说「本地数据中没有足够信息」，并指出还需要什么资料；最后给出 1~3 条跟进建议。

${ANALYSIS_JSON_INSTRUCTION}`

  return { system: SYSTEM_PROMPT, user }
}

// ── 解析模型输出（容忍 ```json 包裹与前后说明）──
export function parseAiJson(text) {
  if (!text) return null
  const raw = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  const tryParse = s => {
    try {
      const o = JSON.parse(s)
      if (!o || typeof o !== 'object') return null
      const out = {
        summary: typeof o.summary === 'string' ? o.summary : '',
        sections: Array.isArray(o.sections)
          ? o.sections
              .filter(s => s && typeof s === 'object')
              .map(s => ({
                title: String(s.title || '').trim(),
                items: (Array.isArray(s.items) ? s.items : []).map(x => String(x)).filter(Boolean),
              }))
              .filter(s => s.title && s.items.length)
          : [],
        risks: (Array.isArray(o.risks) ? o.risks : []).map(x => String(x)).filter(Boolean),
        next_actions: (Array.isArray(o.next_actions) ? o.next_actions : []).map(x => String(x)).filter(Boolean),
      }
      if (!out.summary && !out.sections.length && !out.risks.length && !out.next_actions.length) return null
      return out
    } catch {
      return null
    }
  }
  const direct = tryParse(raw)
  if (direct) return direct
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) return tryParse(raw.slice(start, end + 1))
  return null
}
