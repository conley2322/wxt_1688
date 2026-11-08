<!-- AiPage.vue — 顶层 AI 分析：整体数据洞察 + 本地检索问答（RAG） -->
<template>
  <section class="ai-page">
    <div class="page-head">
      <h2 class="page-title">AI 分析</h2>
      <el-button v-if="!aiReady" size="small" type="primary" plain @click="router.push('/settings')">去配置 AI 接口</el-button>
    </div>

    <el-alert
      v-if="!aiReady"
      type="warning"
      :closable="false"
      show-icon
      title="尚未配置 AI 接口"
      description="到「系统设置 → AI 分析配置」填写接口地址、API Key 和模型后即可使用；未配置时仍可使用本地检索（不消耗任何额度）。"
      style="margin-bottom:16px"
    />

    <!-- 数据规模总览 -->
    <div v-if="loadingCtx" class="ai-skeleton">
      <el-skeleton :rows="2" animated />
    </div>
    <div v-else-if="overviewCtx" class="ai-stats">
      <div class="ai-stat"><span class="as-num">{{ overviewCtx.totals.supplier_count }}</span><span class="as-label">供应商</span></div>
      <div class="ai-stat"><span class="as-num">{{ overviewCtx.totals.product_count }}</span><span class="as-label">商品</span></div>
      <div class="ai-stat"><span class="as-num">{{ overviewCtx.totals.view_count }}</span><span class="as-label">浏览次数</span></div>
      <div class="ai-stat"><span class="as-num">{{ overviewCtx.totals.chat_count }}</span><span class="as-label">聊天记录</span></div>
      <div class="ai-stat"><span class="as-num">{{ overviewCtx.chat_noise.kept }}</span><span class="as-label">有效聊天</span></div>
      <div class="ai-stat"><span class="as-num">{{ overviewCtx.chat_noise.filtered }}</span><span class="as-label">已过滤噪音</span></div>
    </div>

    <div class="ai-tabs">
      <span class="ai-tab" :class="{ on: activeTab === 'overview' }" @click="activeTab = 'overview'">整体分析</span>
      <span class="ai-tab" :class="{ on: activeTab === 'retrieve' }" @click="activeTab = 'retrieve'">定向检索</span>
    </div>

    <!-- 整体分析 -->
    <el-card v-show="activeTab === 'overview'" class="ai-card">
      <template #header>
        <div class="card-head">
          <span>整体数据洞察</span>
          <div class="card-actions">
            <span v-if="overviewMeta" class="ai-meta">{{ overviewMeta.model }} · {{ fmtMetaTime(overviewMeta.at) }}</span>
            <el-button v-if="analyzing" size="small" @click="cancelOverview">取消</el-button>
            <el-button v-else size="small" type="primary" :loading="false" :disabled="loadingCtx" @click="runOverview">
              {{ overviewResult || overviewRaw ? '重新分析' : '生成整体分析' }}
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="overviewError" class="ai-error">{{ overviewError }}</div>

      <div v-if="analyzing" class="ai-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在汇总数据并请求 AI（数据量大时可能需要几十秒）…</span>
      </div>
      <template v-else>
        <div v-if="overviewCtx" class="ai-scope">
          分析口径：供应商 Top {{ overviewCtx.scope.suppliers_included }}/{{ overviewCtx.scope.suppliers_total }}，
          商品 Top {{ overviewCtx.scope.products_included }}/{{ overviewCtx.scope.products_total }}，
          聊天每供应商取最近记录（已过滤系统/自动回复/寒暄/重复 {{ overviewCtx.chat_noise.filtered }} 条）。
          数据更多时会自动扩大聚合范围，但始终只发送 TopN + 聚合结果，不会把全量明细塞给模型。
        </div>
        <AiAnalysisView v-if="overviewResult || overviewRaw" :result="overviewResult" :raw="overviewRaw" />
        <div v-else class="ai-empty">
          点击「生成整体分析」，AI 会基于供应商池、商品浏览、聊天沟通和数据缺口给出整体判断与跟进建议。
        </div>
      </template>
    </el-card>

    <!-- 定向检索 -->
    <el-card v-show="activeTab === 'retrieve'" class="ai-card">
      <template #header>
        <div class="card-head">
          <span>定向检索（本地召回 + 可选 Rerank + AI 归纳）</span>
          <span class="ai-meta">先在本地用 BM25 检索相关供应商/商品/聊天，再由 Rerank 重排（已启用时），最后只把命中片段交给 AI</span>
        </div>
      </template>

      <div class="retrieve-bar">
        <el-input
          v-model="question"
          placeholder="例如：哪些供应商做定制卫衣？谁报过最低价或支持一件代发？"
          clearable
          @keyup.enter="runRetrieve"
        />
        <el-button type="primary" :loading="retrieving" :disabled="!question.trim()" @click="runRetrieve">检索并分析</el-button>
      </div>
      <div v-if="retrieveError" class="ai-error">{{ retrieveError }}</div>
      <div v-if="rerankNote" class="ai-rerank-note">{{ rerankNote }}</div>

      <div v-if="retrieving" class="ai-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ retrievePhase === 'analyzing' ? '已找到相关记录，正在请求 AI 归纳…' : retrievePhase === 'reranking' ? '本地召回完成，正在用 Rerank 模型重新排序…' : '正在本地检索…' }}</span>
      </div>

      <template v-else>
        <div v-if="retrieveHits.length" class="hit-list">
          <div class="hit-title">
            {{ rerankMeta ? '重排序后命中' : '本地命中' }} {{ retrieveHits.length }} 个供应商
            <span v-if="rerankMeta" class="hit-rerank">已重排序 · {{ rerankMeta.model }}</span>
            <span v-if="retrieveIndexed" class="hit-index">（索引：供应商 {{ retrieveIndexed.suppliers }} / 聊天 {{ retrieveIndexed.chats }} / 商品 {{ retrieveIndexed.products }}）</span>
          </div>
          <div v-for="h in retrieveHits" :key="h.name" class="hit-item">
            <div class="hit-head">
              <span class="hit-name" @click="openSupplier(h.name)">{{ h.name }}</span>
              <span class="hit-stats">
                <span v-if="h.rerank_score != null" class="hit-score">相关度 {{ h.rerank_score.toFixed(3) }} · </span>商品 {{ h.product_count }} · 浏览 {{ h.view_count }}
              </span>
            </div>
            <div v-if="hitTags(h).length" class="hit-tags">
              <el-tag v-for="t in hitTags(h)" :key="t" size="small" effect="plain">{{ t }}</el-tag>
            </div>
            <div v-if="h.snippets.length" class="hit-snippets">
              <div v-for="(s, i) in h.snippets" :key="i" class="hit-snippet">
                <span class="hs-who">{{ s.sender === 'me' ? '我' : '供应商' }}</span>{{ s.text }}
              </div>
            </div>
            <div v-if="h.matched_products.length" class="hit-products">
              命中商品：{{ h.matched_products.join('、') }}
            </div>
          </div>
        </div>
        <div v-else-if="searched" class="ai-empty">没有检索到相关供应商，换个关键词试试。</div>
        <div v-else class="ai-empty">输入问题后会先在本地索引中检索，不会上传全量数据。</div>

        <div v-if="retrieveResult || retrieveRaw" class="retrieve-answer">
          <div class="answer-head">AI 归纳<span v-if="retrieveMeta" class="ai-meta">{{ retrieveMeta.model }} · {{ fmtMetaTime(retrieveMeta.at) }}</span></div>
          <AiAnalysisView :result="retrieveResult" :raw="retrieveRaw" />
        </div>
        <div v-else-if="searched && retrieveHits.length && !aiReady" class="ai-inline-tip">
          以上为本地检索结果。配置 AI 接口后，这里会额外给出归纳回答。
        </div>
      </template>
    </el-card>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '../utils/useApi.js'
import { getAiConfig, isAiConfigured, chatComplete, getRerankConfig, isRerankConfigured, rerankDocuments } from '@/utils/aiClient.js'
import { buildOverviewPrompt, buildRetrievalPrompt, parseAiJson } from '@/utils/aiPrompts.js'
import AiAnalysisView from '../components/AiAnalysisView.vue'

const router = useRouter()

const aiReady = ref(false)
const overviewCtx = ref(null)
const loadingCtx = ref(false)

const activeTab = ref('overview')

// 整体分析
const analyzing = ref(false)
const overviewResult = ref(null)
const overviewRaw = ref('')
const overviewError = ref('')
const overviewMeta = ref(null)
let overviewCtrl = null

// 定向检索
const question = ref('')
const retrieving = ref(false)
const retrievePhase = ref('')
const retrieveHits = ref([])
const retrieveIndexed = ref(null)
const retrieveResult = ref(null)
const retrieveRaw = ref('')
const retrieveError = ref('')
const retrieveMeta = ref(null)
const rerankMeta = ref(null)
const rerankNote = ref('')
const searched = ref(false)
let retrieveCtrl = null

onMounted(async () => {
  const cfg = await getAiConfig()
  aiReady.value = isAiConfigured(cfg)
  loadOverviewContext()
})

async function loadOverviewContext() {
  loadingCtx.value = true
  try {
    const res = await api('/api/v1/ai/context/overview', 'GET')
    if (res.code === 200) overviewCtx.value = res.data
    else ElMessage.error(res.message || '读取数据规模失败')
  } catch (e) {
    console.error('[AI] 读取全局上下文失败:', e)
    ElMessage.error('读取数据规模失败')
  } finally {
    loadingCtx.value = false
  }
}

function cancelOverview() {
  overviewCtrl?.abort()
}

async function runOverview() {
  if (!aiReady.value) {
    ElMessage.warning('请先在「系统设置」配置 AI 接口')
    return
  }
  if (!overviewCtx.value) await loadOverviewContext()
  if (!overviewCtx.value) return

  analyzing.value = true
  overviewError.value = ''
  overviewResult.value = null
  overviewRaw.value = ''
  overviewCtrl = new AbortController()
  try {
    const prompt = buildOverviewPrompt(overviewCtx.value)
    const text = await chatComplete({ ...prompt, maxTokens: 4000, signal: overviewCtrl.signal })
    const parsed = parseAiJson(text)
    if (parsed) overviewResult.value = parsed
    else overviewRaw.value = text
    const cfg = await getAiConfig()
    overviewMeta.value = { at: Date.now(), model: cfg.model }
  } catch (e) {
    if (e.message !== '已取消') {
      overviewError.value = e.message
      ElMessage.error(e.message)
    }
  } finally {
    analyzing.value = false
    overviewCtrl = null
  }
}

async function runRetrieve() {
  const q = question.value.trim()
  if (!q || retrieving.value) return
  retrieving.value = true
  retrievePhase.value = 'retrieving'
  retrieveError.value = ''
  retrieveHits.value = []
  retrieveResult.value = null
  retrieveRaw.value = ''
  retrieveMeta.value = null
  rerankMeta.value = null
  rerankNote.value = ''
  searched.value = false
  retrieveCtrl = new AbortController()
  try {
    const rerankCfg = await getRerankConfig()
    const useRerank = isRerankConfigured(rerankCfg)
    // 启用重排序时多召回一些候选，给 rerank 留出重排空间
    const res = await api('/api/v1/ai/retrieve', 'POST', { question: q, limit: useRerank ? 12 : 6 })
    if (res.code !== 200) throw new Error(res.message || '本地检索失败')
    let hits = res.data.hits || []
    retrieveIndexed.value = res.data.indexed || null

    if (useRerank && hits.length > 1) {
      retrievePhase.value = 'reranking'
      try {
        const docs = hits.map(hitDocument)
        const results = await rerankDocuments({
          query: q,
          documents: docs,
          topN: Math.min(docs.length, 8),
          signal: retrieveCtrl.signal,
        })
        const scoreByIndex = new Map(results.map(r => [r.index, r.score]))
        hits = hits
          .map((h, i) => ({ ...h, rerank_score: scoreByIndex.has(i) ? scoreByIndex.get(i) : null }))
          .filter(h => h.rerank_score !== null)
          .sort((a, b) => b.rerank_score - a.rerank_score)
          .slice(0, 6)
        rerankMeta.value = { model: rerankCfg.model, at: Date.now() }
      } catch (e) {
        if (e.message === '已取消') throw e
        // 重排序是可选的增强，失败时退回 BM25 结果，不影响检索
        rerankNote.value = `重排序失败，已按本地 BM25 顺序展示：${e.message}`
      }
    }

    retrieveHits.value = hits
    searched.value = true
    if (!retrieveHits.value.length || !aiReady.value) return

    retrievePhase.value = 'analyzing'
    const prompt = buildRetrievalPrompt(q, retrieveHits.value)
    const text = await chatComplete({ ...prompt, maxTokens: 3000, signal: retrieveCtrl.signal })
    const parsed = parseAiJson(text)
    if (parsed) retrieveResult.value = parsed
    else retrieveRaw.value = text
    const cfg = await getAiConfig()
    retrieveMeta.value = { at: Date.now(), model: cfg.model }
  } catch (e) {
    if (e.message !== '已取消') {
      retrieveError.value = e.message
      ElMessage.error(e.message)
    }
  } finally {
    retrieving.value = false
    retrievePhase.value = ''
    retrieveCtrl = null
  }
}

function hitTags(h) {
  const a = h.archive || {}
  return [a.model, a.trade, a.cert, a.employees, a.area].filter(Boolean)
}

// 送去 rerank 的供应商文档：档案 + 命中商品 + 聊天片段（截断，控制请求体大小）
function hitDocument(h) {
  const a = h.archive || {}
  return [
    h.name,
    a.model, a.trade, a.cert, a.employees, a.area,
    ...(h.top_products || []),
    ...(h.snippets || []).map(s => s.text),
  ].filter(Boolean).join(' ').slice(0, 1200)
}

function openSupplier(name) {
  router.push({ path: '/sources', query: { name } })
}

function fmtMetaTime(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style scoped>
.ai-page { padding-bottom: 24px; }
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 600; color: #303133; margin: 0; }

.ai-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
.ai-stat {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.as-num { font-size: 20px; font-weight: 700; color: #303133; }
.as-label { font-size: 12px; color: #909399; }
.ai-skeleton { margin-bottom: 16px; }

.ai-tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 14px;
}
.ai-tab {
  padding: 8px 2px 10px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.ai-tab:hover { color: #c9975c; }
.ai-tab.on { color: #c9975c; font-weight: 600; border-bottom-color: #c9975c; }

.ai-card { min-height: 260px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-actions { display: flex; align-items: center; gap: 10px; }
.ai-meta { font-size: 12px; color: #a8abb2; font-weight: 400; }
.ai-scope { font-size: 12px; color: #909399; line-height: 1.7; background: #f8f9fa; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; }
.ai-empty { font-size: 13px; color: #a8abb2; padding: 24px 0; text-align: center; }
.ai-loading { display: flex; align-items: center; gap: 8px; color: #909399; font-size: 13px; padding: 28px 0; justify-content: center; }
.ai-loading .el-icon { font-size: 16px; color: #c9975c; }
.ai-error { background: #fef0f0; color: #c45656; font-size: 13px; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
.ai-rerank-note { background: #fdf6ec; color: #b88230; font-size: 12px; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
.ai-inline-tip { font-size: 12px; color: #909399; margin-top: 12px; }

.retrieve-bar { display: flex; gap: 10px; margin-bottom: 14px; }
.hit-list { margin-top: 6px; }
.hit-title { font-size: 13px; color: #606266; margin-bottom: 10px; }
.hit-rerank { font-size: 11px; color: #a87b3f; background: #faf1e6; border-radius: 4px; padding: 1px 6px; margin-left: 8px; }
.hit-index { font-size: 12px; color: #a8abb2; margin-left: 8px; }
.hit-score { color: #a87b3f; }
.hit-item { border: 1px solid #f0f2f5; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; }
.hit-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.hit-name { font-size: 14px; font-weight: 600; color: #a87b3f; cursor: pointer; }
.hit-name:hover { text-decoration: underline; }
.hit-stats { font-size: 12px; color: #909399; }
.hit-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.hit-snippets { margin-top: 8px; border-left: 2px solid #f0e4d4; padding-left: 10px; }
.hit-snippet { font-size: 12px; color: #5b4a35; line-height: 1.6; margin-bottom: 3px; }
.hs-who { color: #a8abb2; margin-right: 6px; }
.hit-products { font-size: 12px; color: #909399; margin-top: 6px; }
.retrieve-answer { margin-top: 20px; border-top: 1px dashed #ebeef5; padding-top: 16px; }
.answer-head { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 10px; display: flex; align-items: baseline; justify-content: space-between; }
</style>
