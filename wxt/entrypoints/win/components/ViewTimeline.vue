<script setup>
// 商品浏览时间轴（方案 D：按天日历热力图）
// 顶部常驻总统计；热力图近 150 天、格子越绿 = 那天停留越久（正方形小方格）；
// 点格子查看当天每一次浏览；窗口外的更早有记录天折叠在明细下方，点击同样展开
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '@/utils/dataClient.js'
import HsCalendarHeatmap from '@/components/HsCalendarHeatmap.vue'

const props = defineProps({
  target: { type: [String, Number], required: true },
})

const list = ref([])        // 全量浏览记录（正序）
const totalDwell = ref(0)   // 总停留秒数
const daily = ref([])       // [{date:'YYYY-MM-DD', count, dwell}] 全历史按天聚合
const selected = ref('')    // 当前选中的天

async function load() {
  const res = await api(`/api/v1/products/${encodeURIComponent(props.target)}/view-timeline`)
  if (res.code === 200) {
    list.value = res.data
    totalDwell.value = res.total_dwell || 0
    daily.value = res.daily || []
    // 默认选中最近有记录的一天
    if (!selected.value || !daily.value.some(d => d.date === selected.value)) {
      selected.value = daily.value.length ? daily.value[daily.value.length - 1].date : ''
    }
  }
}

onMounted(() => load())
watch(() => props.target, () => { selected.value = ''; load() })

function dateKey(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
// 选中天的逐次明细（正序）
const dayItems = computed(() =>
  selected.value ? list.value.filter(it => dateKey(it.viewed_at) === selected.value) : [])
const dayStat = computed(() => daily.value.find(d => d.date === selected.value))
const dayMax = computed(() => Math.max(...dayItems.value.map(it => it.duration || 0), 1))
// 热力图窗口（近 150 天）之外仍有记录的更早天（降序），点击同样展开明细
const windowStart = computed(() => {
  const d = new Date(Date.now() - 149 * 86400000)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})
const olderDays = computed(() =>
  daily.value.filter(d => d.date < windowStart.value).slice().sort((a, b) => (a.date < b.date ? 1 : -1)))

const AVATAR_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4444', '#14b8a6', '#f97316']
function avatarColor(name, mine) {
  if (mine) return '#1677ff'
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function fmtTime(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
// 停留秒数 → 50秒 / 3分12秒 / 1小时5分
function fmtDwell(sec) {
  const s = Math.round(Number(sec) || 0)
  if (s <= 0) return ''
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}分${s % 60 ? String(s % 60).padStart(2, '0') + '秒' : ''}`
  return `${Math.floor(m / 60)}小时${m % 60 ? m % 60 + '分' : ''}`
}
</script>

<template>
  <div class="vt-wrap">
    <!-- 顶部总统计：本商品一共看了多少次、停留总时长 -->
    <div class="vt-total" v-if="list.length">
      浏览 <b>{{ list.length }}</b> 次
      <template v-if="totalDwell > 0"> · 共停留 <b class="gold">{{ fmtDwell(totalDwell) }}</b></template>
      <span class="vt-hint">近 150 天 · 格子越绿停留越久</span>
    </div>
    <div class="vt-scroll">
      <div v-if="!list.length" class="vt-empty">暂无浏览记录</div>
      <template v-else>
        <HsCalendarHeatmap :daily="daily" @pick="selected = $event" />

        <!-- 选中天的逐次明细 -->
        <div class="vt-day" v-if="selected && dayItems.length">
          <div class="vt-day-head">
            <b>{{ selected.slice(5).replace('-', '/') }}</b>
            <span class="vt-day-sum">
              {{ dayItems.length }} 次<template v-if="dayStat && dayStat.dwell > 0"> · 停留 {{ fmtDwell(dayStat.dwell) }}</template>
            </span>
          </div>
          <div v-for="(it, i) in dayItems" :key="it.viewed_at + '-' + i" class="vt-row">
            <span class="vt-avatar" :style="{ background: avatarColor(it.nickname, it.mine) }">
              {{ it.mine ? '我' : (it.nickname || '?').slice(0, 1) }}
            </span>
            <span class="vt-name">{{ it.mine ? '我' : it.nickname }}</span>
            <span class="meter" :class="{ z: !it.duration }"><i :style="{ width: Math.round((it.duration || 0) / dayMax * 100) + '%' }"></i></span>
            <span class="vt-dwell" :class="{ z: !it.duration }">{{ it.duration ? fmtDwell(it.duration) : '—' }}</span>
            <span class="vt-time">{{ fmtTime(it.viewed_at) }}</span>
          </div>
        </div>

        <!-- 热力图窗口外更早的有记录天 -->
        <template v-if="olderDays.length">
          <div class="vt-older-head">更早（{{ olderDays.length }} 天，点击展开）</div>
          <div v-for="d in olderDays" :key="d.date" class="vt-older-row" @click="selected = d.date">
            <b>{{ d.date.slice(5).replace('-', '/') }}</b>
            <span>{{ d.count }} 次</span>
            <span class="vt-older-dwell" v-if="d.dwell > 0">{{ fmtDwell(d.dwell) }}</span>
          </div>
        </template>
      </template>
    </div>
    <div class="vt-status">点热力图格子查看当天每一次浏览</div>
  </div>
</template>

<style scoped>
.vt-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.vt-total {
  flex-shrink: 0;
  font-size: 11px;
  color: #888;
  padding: 4px 10px 2px;
  border-bottom: 1px dashed #f0f0f0;
}
.vt-total b { color: #c9975c; font-weight: 600; }
.vt-hint { color: #bbb; font-size: 10px; margin-left: 6px; }
.vt-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 8px 2px;
}
.vt-empty {
  font-size: 12px;
  color: #bbb;
  text-align: center;
  padding: 20px 0;
}
/* 选中天明细 */
.vt-day-head {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #333;
  padding: 4px 2px 2px;
}
.vt-day-head b { font-weight: 600; }
.vt-day-sum { margin-left: auto; font-size: 11px; color: #4a7c5e; font-weight: 600; }
.vt-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 2px;
}
.vt-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.vt-name { font-size: 12px; color: #333; font-weight: 600; white-space: nowrap; }
.meter {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #f1f2f4;
  overflow: hidden;
  min-width: 30px;
}
.meter i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #a9cfb6, #7fb28f); }
.meter.z i { display: none; }
.vt-dwell { font-size: 10px; color: #4a7c5e; font-weight: 600; width: 52px; text-align: right; white-space: nowrap; }
.vt-dwell.z { color: #c0c4cc; font-weight: 400; }
.vt-time { font-size: 11px; color: #aaa; width: 38px; text-align: right; }
/* 更早折叠 */
.vt-older-head {
  font-size: 10px;
  color: #c0c4cc;
  padding: 8px 2px 2px;
}
.vt-older-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #888;
  padding: 4px 2px;
  border-top: 1px dashed #f2f2f2;
  cursor: pointer;
}
.vt-older-row b { color: #333; font-weight: 600; }
.vt-older-row:hover { background: #f7f9f8; }
.vt-older-dwell { margin-left: auto; color: #4a7c5e; font-weight: 600; }
.vt-status {
  font-size: 10px;
  color: #c0c4cc;
  text-align: center;
  padding: 2px 0 3px;
  flex-shrink: 0;
}
</style>
