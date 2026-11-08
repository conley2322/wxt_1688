// aiClient.js — AI 接口配置与调用（OpenAI 兼容的 /chat/completions）
// 配置只保存在本机 browser.storage.local，请求从扩展页面直接发往用户填写的地址。

const STORAGE_KEY = 'aiConfig'

// 常见 OpenAI 兼容服务商预设：用户只需选服务商 + 填自己的 Key
export const AI_PROVIDERS = [
  {
    key: 'sensenova',
    label: '商汤日日新',
    baseUrl: 'https://token.sensenova.cn/v1',
    model: 'sensenova-6.8-flash-lite',
    models: ['sensenova-6.8-flash-lite', 'deepseek-v4-flash', 'deepseek-v4-pro', 'glm-5.2'],
    docs: 'https://platform.sensenova.cn/docs',
    keyUrl: 'https://platform.sensenova.cn/console/keys',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    docs: 'https://platform.openai.com/docs',
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    docs: 'https://api-docs.deepseek.com',
  },
]

const DEFAULT_PROVIDER = AI_PROVIDERS[0]

export const AI_DEFAULTS = {
  baseUrl: DEFAULT_PROVIDER.baseUrl,
  apiKey: '',
  model: DEFAULT_PROVIDER.model,
  temperature: 0.3,
}

export function detectProvider(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '').toLowerCase()
  if (!base) return DEFAULT_PROVIDER.key
  const hit = AI_PROVIDERS.find(p => base === p.baseUrl || base.startsWith(p.baseUrl + '/'))
  return hit ? hit.key : 'custom'
}

export async function getAiConfig() {
  const stored = await browser.storage.local.get(STORAGE_KEY)
  return { ...AI_DEFAULTS, ...(stored[STORAGE_KEY] || {}) }
}

export async function saveAiConfig(patch) {
  const cfg = { ...(await getAiConfig()), ...patch }
  cfg.baseUrl = String(cfg.baseUrl || '').trim().replace(/\/+$/, '')
  cfg.apiKey = String(cfg.apiKey || '').trim()
  cfg.model = String(cfg.model || '').trim()
  cfg.temperature = Math.max(0, Math.min(2, Number(cfg.temperature) || 0))
  await browser.storage.local.set({ [STORAGE_KEY]: cfg })
  return cfg
}

export function isAiConfigured(cfg) {
  return !!(cfg && cfg.baseUrl && cfg.apiKey && cfg.model)
}

export function endpointOf(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/chat\/completions$/.test(base)) return base
  return base + '/chat/completions'
}

function friendlyError(status, data) {
  const msg = data?.error?.message || data?.message || ''
  if (status === 401 || status === 403) return '鉴权失败（401/403）：请检查 API Key 是否正确、是否有该模型权限'
  if (status === 404) return '接口不存在（404）：请检查接口地址，通常应以 /v1 结尾'
  if (status === 429) return '请求过于频繁或额度不足（429）：请稍后再试或检查账户余额'
  if (status >= 500) return `AI 服务暂时不可用（${status}）${msg ? '：' + msg : ''}`
  return `AI 接口返回错误（${status}）${msg ? '：' + msg : ''}`
}

function pickContent(c) {
  if (c == null) return ''
  if (typeof c === 'string') return c
  if (typeof c === 'number') return String(c)
  if (Array.isArray(c)) return c.map(pickContent).join('')
  if (typeof c === 'object') {
    return pickContent(c.text ?? c.content ?? c.value ?? c.output_text ?? '')
  }
  return ''
}

// 兼容各家的返回结构：OpenAI choices[].message.content（字符串/分段数组）、
// 补全式 choices[].text、以及 Responses 风格的 output_text。
// 注意：不使用 reasoning_content（思考过程）冒充正文。
function contentOf(data) {
  if (!data) return ''
  const choice = data?.choices?.[0]
  const candidates = [
    choice?.message?.content,
    choice?.delta?.content,
    choice?.text,
    data.output_text,
    data.output?.text,
    Array.isArray(data.output)
      ? data.output.map(o => pickContent(o?.content)).join('')
      : undefined,
  ]
  for (const c of candidates) {
    const t = pickContent(c).trim()
    if (t) return t
  }
  return ''
}

// 空正文时给出可比对的诊断信息，而不是只说「模型名称是否正确」
function emptyResponseError(data, cfg) {
  const choice = data?.choices?.[0]
  const finish = choice?.finish_reason || ''
  const hasReasoning = !!(choice?.message?.reasoning_content || choice?.message?.reasoning)
  const usage = data?.usage || {}
  const bits = [`模型 ${cfg.model}`]
  if (finish) bits.push(`finish_reason=${finish}`)
  if (hasReasoning) bits.push('模型只返回了思考内容，正文为空')
  if (usage.completion_tokens != null) bits.push(`输出 tokens ${usage.completion_tokens}`)
  else if (usage.total_tokens != null) bits.push(`总 tokens ${usage.total_tokens}`)
  const hint = finish === 'length'
    ? '思考占满了输出配额（已自动调大上限重试仍失败），请换非推理模型'
    : hasReasoning
      ? '模型只返回了思考内容（已自动调大上限重试仍失败），请换非推理模型'
      : '请检查模型名称是否正确，或换一个模型试'
  return `AI 接口返回为空（${bits.join('，')}）：${hint}`
}

export async function chatComplete({ system, user, messages, maxTokens = 2000, temperature, thinking, timeoutMs = 120000, signal } = {}) {
  const cfg = await getAiConfig()
  if (!isAiConfigured(cfg)) throw new Error('尚未配置 AI 接口，请先到「系统设置」填写接口地址、API Key 和模型')
  const url = endpointOf(cfg.baseUrl)
  // 商汤思考模式与正文共用 max_tokens，默认思考很容易把配额全耗在推理上、正文为空。
  // 本扩展的总结/问答不需要深度思考，所以默认关闭；thinking: 'enabled' 可显式开启。
  let useThinkingParam = detectProvider(cfg.baseUrl) === 'sensenova'
  const thinkingType = thinking === 'enabled' ? 'enabled' : 'disabled'
  const nextTokens = n => Math.min(Math.max(n * 2, 4096), 12288)

  // 支持直接传对话消息数组（多轮聊天），也兼容原来的 system + user
  const msgList = Array.isArray(messages) && messages.length
    ? messages
        .filter(m => m && m.content != null)
        .map(m => ({
          role: ['system', 'assistant', 'user'].includes(m.role) ? m.role : 'user',
          content: String(m.content),
        }))
    : [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...(user ? [{ role: 'user', content: user }] : []),
      ]
  if (!msgList.length) throw new Error('消息为空')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs)
  const onAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    const request = async (list, tokens) => {
      const payload = {
        model: cfg.model,
        temperature: temperature ?? cfg.temperature,
        max_tokens: tokens,
        messages: list,
      }
      if (useThinkingParam) payload.thinking = { type: thinkingType }
      let res
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        })
      } catch (e) {
        if (ctrl.signal.aborted && !(signal && signal.aborted)) throw new Error('请求超时：AI 接口在 120 秒内没有返回，请稍后重试或更换模型')
        if (signal && signal.aborted) throw new Error('已取消')
        throw new Error('网络请求失败：请检查接口地址、网络连接，或该地址是否允许跨域访问')
      }
      let text = ''
      try { text = await res.text() } catch { text = '' }
      let data = null
      try { data = text ? JSON.parse(text) : null } catch { data = null }
      if (!res.ok) throw new Error(friendlyError(res.status, data || { message: text.slice(0, 200) }))
      if (!data) throw new Error(`AI 接口返回的不是 JSON，无法解析：${text.slice(0, 160) || '（空响应）'}`)
      return data
    }

    // 个别模型不接受 thinking 参数会直接 400，此时去掉该参数重试
    const call = async (list, tokens) => {
      try {
        return await request(list, tokens)
      } catch (e) {
        if (useThinkingParam && /400/.test(e.message)) {
          console.warn('[aiClient] 模型不接受 thinking 参数，去掉后重试：', e.message)
          useThinkingParam = false
          return request(list, tokens)
        }
        throw e
      }
    }

    let tokens = maxTokens
    let usedList = msgList
    let data = await call(usedList, tokens)
    let answer = contentOf(data).trim()
    // 少数 OpenAI 兼容接口对 system 角色处理异常（返回 200 但正文为空）：
    // 去掉 system 角色、合并成单条用户消息重试一次。
    if (!answer && msgList.some(m => m.role === 'system')) {
      console.warn('[aiClient] 首次返回空正文，改为单条用户消息重试', data)
      usedList = [{
        role: 'user',
        content: msgList
          .map(m => (m.role === 'system' ? m.content : `[${m.role === 'assistant' ? '助手' : '用户'}] ${m.content}`))
          .join('\n\n'),
      }]
      tokens = nextTokens(tokens)
      data = await call(usedList, tokens)
      answer = contentOf(data).trim()
    }
    // 思考模型可能把输出配额全用在推理上（finish_reason=length 且正文为空），逐级调大上限
    for (let i = 0; i < 2 && !answer; i++) {
      const choice = data?.choices?.[0]
      const finish = choice?.finish_reason
      const hasReasoning = !!(choice?.message?.reasoning_content || choice?.message?.reasoning)
      if (finish !== 'length' && !hasReasoning) break
      tokens = nextTokens(tokens)
      console.warn('[aiClient] 输出配额被思考占用，调大上限重试', { finish, tokens })
      data = await call(usedList, tokens)
      answer = contentOf(data).trim()
    }
    if (!answer) {
      console.warn('[aiClient] 返回正文为空，原始响应：', data)
      throw new Error(emptyResponseError(data, cfg))
    }
    return answer
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

export async function testAiConnection() {
  const reply = await chatComplete({
    system: '你是接口连通性测试助手，只回复两个字母：OK',
    user: 'ping',
    maxTokens: 16,
    temperature: 0,
    timeoutMs: 30000,
  })
  return reply
}

// ── 重排序（Rerank）：把 BM25 召回的候选送给 rerank 模型重新打分 ──
// 默认硅基流动的 BAAI/bge-reranker-v2-m3；Key 同样只存本机。
const RERANK_KEY = 'rerankConfig'

export const RERANK_DEFAULTS = {
  enabled: false,
  baseUrl: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  model: 'BAAI/bge-reranker-v2-m3',
}

export async function getRerankConfig() {
  const stored = await browser.storage.local.get(RERANK_KEY)
  return { ...RERANK_DEFAULTS, ...(stored[RERANK_KEY] || {}) }
}

export async function saveRerankConfig(patch) {
  const cfg = { ...(await getRerankConfig()), ...patch }
  cfg.baseUrl = String(cfg.baseUrl || '').trim().replace(/\/+$/, '')
  cfg.apiKey = String(cfg.apiKey || '').trim()
  cfg.model = String(cfg.model || '').trim()
  cfg.enabled = !!cfg.enabled
  await browser.storage.local.set({ [RERANK_KEY]: cfg })
  return cfg
}

export function isRerankConfigured(cfg) {
  return !!(cfg && cfg.enabled && cfg.baseUrl && cfg.apiKey && cfg.model)
}

function rerankEndpointOf(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/rerank$/.test(base)) return base
  return base + '/rerank'
}

export async function rerankDocuments({ query, documents, topN, timeoutMs = 30000, signal } = {}) {
  const cfg = await getRerankConfig()
  if (!isRerankConfigured(cfg)) throw new Error('尚未启用重排序，或未填写 Rerank 接口地址 / Key / 模型')
  const docs = (documents || []).map(d => String(d || '').trim()).filter(Boolean)
  if (!docs.length) return []

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs)
  const onAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    let res
    try {
      res = await fetch(rerankEndpointOf(cfg.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          query: String(query || ''),
          documents: docs,
          ...(topN ? { top_n: Math.min(Number(topN) || docs.length, docs.length) } : {}),
          return_documents: false,
        }),
        signal: ctrl.signal,
      })
    } catch (e) {
      if (ctrl.signal.aborted && !(signal && signal.aborted)) throw new Error('重排序请求超时，请稍后重试或关闭重排序')
      if (signal && signal.aborted) throw new Error('已取消')
      throw new Error('重排序网络请求失败：请检查接口地址、网络连接，或该地址是否允许跨域访问')
    }
    let data = null
    try { data = await res.json() } catch { data = null }
    if (!res.ok) throw new Error(friendlyError(res.status, data).replace(/^AI 接口/, '重排序接口'))
    const results = data?.results
    if (!Array.isArray(results)) throw new Error('重排序接口返回格式异常：缺少 results 数组')
    return results
      .filter(r => Number.isFinite(Number(r?.index)))
      .map(r => ({ index: Number(r.index), score: Number(r.relevance_score) || 0 }))
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

export async function testRerankConnection() {
  const results = await rerankDocuments({
    query: '这件卫衣多少钱',
    documents: ['这款卫衣报价 35 元，500 件起订', '今天天气不错'],
    topN: 2,
    timeoutMs: 30000,
  })
  if (!results.length) throw new Error('重排序接口没有返回结果')
  return results
}
