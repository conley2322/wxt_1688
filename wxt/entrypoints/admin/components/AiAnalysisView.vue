<!-- AiAnalysisView.vue — AI 结构化分析结果展示（供应商页签与管理后台共用） -->
<template>
  <div class="ai-result">
    <template v-if="result">
      <p v-if="result.summary" class="ai-summary">{{ result.summary }}</p>
      <div v-for="(sec, i) in result.sections" :key="i" class="ai-sec">
        <h4>{{ sec.title }}</h4>
        <ul>
          <li v-for="(item, j) in sec.items" :key="j">{{ item }}</li>
        </ul>
      </div>
      <div v-if="result.risks.length" class="ai-block risk">
        <h4>风险与不确定点</h4>
        <ul>
          <li v-for="(item, i) in result.risks" :key="i">{{ item }}</li>
        </ul>
      </div>
      <div v-if="result.next_actions.length" class="ai-block action">
        <h4>建议下一步</h4>
        <ol>
          <li v-for="(item, i) in result.next_actions" :key="i">{{ item }}</li>
        </ol>
      </div>
    </template>
    <pre v-else-if="raw" class="ai-raw">{{ raw }}</pre>
  </div>
</template>

<script setup>
defineProps({
  result: { type: Object, default: null },
  raw: { type: String, default: '' },
})
</script>

<style scoped>
.ai-result { font-size: 13px; color: #303133; line-height: 1.7; }
.ai-summary {
  margin: 0 0 14px;
  padding: 10px 14px;
  background: #fdf8f3;
  border-left: 3px solid #c9975c;
  border-radius: 0 6px 6px 0;
  color: #5b4a35;
}
.ai-sec { margin-bottom: 14px; }
.ai-sec h4, .ai-block h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.ai-sec ul, .ai-block ul, .ai-block ol {
  margin: 0;
  padding-left: 20px;
}
.ai-sec li, .ai-block li { margin-bottom: 3px; }
.ai-block {
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: 6px;
}
.ai-block.risk { background: #fef0f0; }
.ai-block.risk h4 { color: #c45656; }
.ai-block.action { background: #fdf8f3; }
.ai-block.action h4 { color: #a87b3f; }
.ai-raw {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
}
</style>
