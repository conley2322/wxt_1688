# 1688 协作面板 — Box 组件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `wxt/entrypoints/box/App.vue` 从旧的商品信息面板重写为团队协作信息面板（标签+评论+浏览记录）

**Architecture:** 单 Vue SFC，所有数据使用组件内虚拟 JSON 模拟。顶栏固定显示三个图标+头像栈，下方 200% 宽滑动容器切换标签/评论两个面板。

**Tech Stack:** Vue 3 (ref/computed)、CSS transition、`-webkit-line-clamp`

---

### Task 1: 替换虚拟数据为协作 JSON 结构

**Files:**
- Modify: `wxt/entrypoints/box/App.vue:2-103`

**改动说明：** 移除旧的商品数据（tagPool、commentPool、namePool、seed 随机逻辑），用两份虚拟 JSON 数据替换：`summaryData`（概要数据，首次渲染）和 `detailData`（详情数据，悬停 💬 时加载）。

- [ ] **Step 1: 删除旧数据和函数**

移除以下代码块（第 29-103 行）：
- `seedHash`、`pick`、`pickCount` 函数
- `tagPool`、`namePool`、`viewerCount`、`viewers`、`totalViews`、`messageCount`
- `commentPool`、`comments`、`commentCount`
- `sortedViewers`
- `fetch(...)` API 调用
- `avatarColors`（后续用虚拟数据中的 `color` 字段）

删除后保留：第 1-28 行（props、offer_id 提取逻辑）、第 5 行 `activePanel = ref(0)`

- [ ] **Step 2: 添加虚拟 JSON 数据**

在 `const activePanel = ref(0)` 之后添加：

```js
// ── 虚拟概要数据（首次渲染） ──
const summaryData = {
  offer_id: "778418269864",
  view_count: 12,
  tag_count: 3,
  comment_count: 2,
  viewers: [
    { name: "Conley", initial: "C", count: 12 },
    { name: "张三",   initial: "张", count: 8 },
    { name: "李四",   initial: "李", count: 5 }
  ],
  tags: [
    { text: "质量问题",   user_name: "Conley", date: "2026-05-12" },
    { text: "可深度合作", user_name: "张三",   date: "2026-05-10" },
    { text: "交期长",     user_name: "王五",   date: "2026-05-08" }
  ]
}

// ── 虚拟详情数据（悬停评论面板时加载） ──
const detailData = {
  offer_id: "778418269864",
  comments: [
    {
      text: "这个供应商质量不错，合作过几次了",
      user_name: "Conley",
      initial: "C",
      date: "2026-05-12",
      color: "#ff6a00"
    },
    {
      text: "注意！这个产品有质量问题，退货率高，建议先拿样品测试再批量订购",
      user_name: "张三",
      initial: "张",
      date: "2025-05-08",
      color: "#2ecc71"
    },
    {
      text: "价格在同行业中有优势",
      user_name: "李四",
      initial: "李",
      date: "2026-05-10",
      color: "#3498db"
    }
  ]
}

// ── 响应式状态 ──
const commentsLoaded = ref(false)
const comments = ref([])

// ── 工具函数：日期格式化 ──
function formatDate(dateStr) {
  // dateStr = "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-')
  const currentYear = new Date().getFullYear()
  if (parseInt(y) === currentYear) return `${parseInt(m)}/${parseInt(d)}`
  return `${y.slice(2)}/${parseInt(m)}/${parseInt(d)}`
}

// ── 按需加载评论 ──
function loadComments() {
  if (commentsLoaded.value) return
  commentsLoaded.value = true
  // 模拟异步加载
  setTimeout(() => {
    comments.value = detailData.comments.map(c => ({
      ...c,
      date: formatDate(c.date)
    }))
  }, 100)
}
```

- [ ] **Step 3: 删除末尾空行**，确认脚本区结尾干净

---

### Task 2: 重写顶栏 — 三个图标 + 头像栈

**Files:**
- Modify: `wxt/entrypoints/box/App.vue:107-131`

**改动说明：** 顶栏左侧三个图标顺序改为 🏷（默认激活）| 💬 | 👁（纯显示），右侧新增头像栈。

- [ ] **Step 1: 替换整个 `.hs-top-row` 模板**

将第 108-131 行的 `<div class="hs-top-row">` 块替换为：

```html
  <div class="hs-top-row" @click.stop.prevent>
    <div class="hs-icon-group">
      <!-- 标签图标（默认） -->
      <span class="hs-icon-btn" :class="{ 'hs-icon-btn--active': activePanel === 0 }"
        @mouseenter="activePanel = 0" title="标签">
        <i class="hs-icon-tag"></i>
        <span class="hs-icon-count">{{ summaryData.tag_count }}</span>
      </span>
      <!-- 评论图标 -->
      <span class="hs-icon-btn" :class="{ 'hs-icon-btn--active': activePanel === 1 }"
        @mouseenter="activePanel = 1; loadComments()" title="评论">
        <i class="hs-icon-comment"></i>
        <span class="hs-icon-count">{{ summaryData.comment_count }}</span>
      </span>
      <!-- 浏览图标（纯显示） -->
      <span class="hs-icon-btn hs-icon-btn--static">
        <i class="hs-icon-eye"></i>
        <span class="hs-icon-count">{{ summaryData.view_count }}</span>
      </span>
    </div>

    <!-- 头像栈 -->
    <div class="hs-avatar-bar">
      <div v-for="(v, i) in summaryData.viewers.slice(0, 5)" :key="i" class="hs-avatar"
        :style="{ background: ['#ff6a00','#2ecc71','#3498db','#9b59b6','#e74c3c','#1abc9c','#f39c12','#34495e'][i % 8] }"
        :title="`${v.name} · ${v.count}次`">{{ v.initial }}</div>
      <span v-if="summaryData.viewers.length > 5" class="hs-avatar-more">+{{ summaryData.viewers.length - 5 }}</span>
    </div>
  </div>
```

注意：这里 `.hs-icon-btn--static` 是一个新的 CSS 类，无 hover/active 效果，仅显示。

---

### Task 3: 重写滑动内容区 — 2 面板（标签 + 评论）

**Files:**
- Modify: `wxt/entrypoints/box/App.vue:133-181`

**改动说明：** 从 3 面板（300%）改为 2 面板（200%），面板顺序：面板0=标签，面板1=评论。移除旧的浏览者排名面板。

- [ ] **Step 1: 替换整个 `.hs-slider` 块**

将第 133-181 行替换为：

```html
  <!-- 滑动内容区 -->
  <div class="hs-slider-wrap">
    <div class="hs-slider" :class="`hs-slider--p${activePanel}`">
      <!-- 面板0：标签（默认） -->
      <div class="hs-panel">
        <div v-if="summaryData.tags.length" class="hs-tags-panel">
          <span v-for="(tag, i) in summaryData.tags" :key="i" class="hs-tag"
            :title="`${tag.user_name} · ${formatDate(tag.date)}`">{{ tag.text }}</span>
        </div>
        <div v-else class="hs-note--empty">暂无标签</div>
        <div class="hs-spacer"></div>
      </div>

      <!-- 面板1：评论 -->
      <div class="hs-panel">
        <div v-if="comments.length" class="hs-comments">
          <div v-for="(c, i) in comments" :key="i" class="hs-comment"
            :title="`${c.user_name}：${c.text}`">
            <div class="hs-cmt-avatar" :style="{ background: c.color }">{{ c.initial }}</div>
            <div class="hs-cmt-body">
              <div class="hs-cmt-text">{{ c.text }}</div>
              <span class="hs-cmt-date">{{ c.date }}</span>
            </div>
          </div>
        </div>
        <div v-else class="hs-note--empty">暂无评论</div>
        <div class="hs-spacer"></div>
      </div>
    </div>
  </div>
```

---

### Task 4: 更新 CSS — 2 面板 + 头像栈 + 标签样式 + 评论截断

**Files:**
- Modify: `wxt/entrypoints/box/App.vue:185-465`（整个 `<style>` 块）

- [ ] **Step 1: 修改滑动类为 2 面板（200%）**

```css
.hs-slider {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.hs-slider--p0 { transform: translateX(0); }
.hs-slider--p1 { transform: translateX(-50%); }
```

- [ ] **Step 2: 修改面板宽度为 50%**

```css
.hs-panel {
  width: 50%;
  /* 其他属性保持不变 */
}
```

删除旧的 `.hs-panel` 相关宽度类。

- [ ] **Step 3: 添加头像栈样式**

在图标按钮组样式之后添加：

```css
/* ── 头像栈 ── */
.hs-avatar-bar {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}

.hs-avatar-bar .hs-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  border: 1.5px solid #f5f6f8;
  cursor: default;
}

.hs-avatar-bar .hs-avatar:not(:first-child) {
  margin-left: -6px;
}

.hs-avatar-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e0e0e0;
  color: #999;
  font-size: 9px;
  font-weight: 500;
  border: 1.5px solid #f5f6f8;
  margin-left: -6px;
  flex-shrink: 0;
}
```

- [ ] **Step 4: 添加 `.hs-icon-btn--static` 样式**

```css
.hs-icon-btn--static {
  cursor: default;
  pointer-events: none;
}
```

- [ ] **Step 5: 重写评论样式（两行省略 + hover title）**

评论结构改为 `.hs-comment > .hs-cmt-body > .hs-cmt-text + .hs-cmt-date`，所以需要更新 CSS：

```css
/* ── 评论 ── */
.hs-comments { font-size: 0; }

.hs-comment {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 3px;
  min-width: 0;
}

.hs-comment:last-child { margin-bottom: 0; }

.hs-cmt-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  margin-top: 1px;
}

.hs-cmt-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.hs-cmt-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.6;
  color: #555;
  word-break: break-all;
}

.hs-cmt-date {
  font-size: 9px;
  color: #bbb;
  flex-shrink: 0;
  line-height: 1.6;
}
```

删除旧的 `.hs-cmt-body--multi`、`.hs-cmt-body--single`、`.hs-cmt-body--single .hs-cmt-text`、`.hs-cmt-body--single .hs-cmt-date`。

- [ ] **Step 6: 重写标签样式（紧凑彩色药丸）**

```css
/* ── 标签面板 ── */
.hs-tags-panel {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.hs-tags-panel .hs-tag {
  display: inline-block;
  padding: 0 5px;
  font-size: 10px;
  line-height: 18px;
  color: #fff;
  border-radius: 3px;
  cursor: default;
}

.hs-tags-panel .hs-tag:nth-child(6n+1) { background: #ff6a00; }
.hs-tags-panel .hs-tag:nth-child(6n+2) { background: #2ecc71; }
.hs-tags-panel .hs-tag:nth-child(6n+3) { background: #3498db; }
.hs-tags-panel .hs-tag:nth-child(6n+4) { background: #9b59b6; }
.hs-tags-panel .hs-tag:nth-child(6n+5) { background: #e74c3c; }
.hs-tags-panel .hs-tag:nth-child(6n+6) { background: #1abc9c; }
```

删除旧的 `.hs-tag--panel`、`.hs-tag--panel:nth-child(...)`、`.hs-viewer-list`、`.hs-viewer-item`、`.hs-viewer-rank`、`.hs-viewer-name`、`.hs-viewer-count`。

- [ ] **Step 7: 删除其他无用 CSS**

删除这些已不使用的选择器：
- `.hs-viewer-*` 全部（浏览者排名面板移除）
- `.hs-tag--panel`（改用 `.hs-tags-panel .hs-tag`）
- `.hs-tag:nth-child` 旧规则（已被新 `.hs-tags-panel .hs-tag:nth-child` 替代）
- `.hs-cmt-body--multi`
- `.hs-cmt-body--single` 及其子选择器

---

### Task 5: 更新 .hs-top-row 布局 — 图标居左、头像居右

**Files:**
- Modify: `wxt/entrypoints/box/App.vue` CSS（`.hs-top-row`、`.hs-icon-group` 部分）

- [ ] **Step 1: 调整 `.hs-top-row` 和 `.hs-icon-group`**

```css
.hs-top-row {
  display: flex;
  align-items: center;
  padding: 4px 8px 0;
  flex-shrink: 0;
  pointer-events: auto;
  min-width: 0;
}

.hs-icon-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
```

把 `margin-left: auto` 从 `.hs-icon-group` 移到 `.hs-avatar-bar`（已在 Task 4 Step 3 中定义）。

---

### Task 6: 自检 + 提交

**Files:**
- Modify: `wxt/entrypoints/box/App.vue`

- [ ] **Step 1: 验证无未使用变量**

检查 IDE 诊断，确保：
- `activePanel` 被模板使用 ✅
- `summaryData`、`detailData`、`comments` 被模板使用 ✅
- `loadComments`、`formatDate` 被模板使用 ✅
- 无 `memberId`、`panelhtml` 等旧变量未使用警告（如果存在则删除）

- [ ] **Step 2: 验证 2 面板滑动行为**

确认：
- `.hs-slider` width 200%
- `.hs-panel` width 50%
- `.hs-slider--p0` → `translateX(0)`
- `.hs-slider--p1` → `translateX(-50%)`

- [ ] **Step 3: 格式化 + 提交**

```bash
git add wxt/entrypoints/box/App.vue
git commit -m "feat: rewrite box panel to team collaboration layout

- Replace product mock data with team collab JSON (tags + comments + viewers)
- Top bar: tag/comment/eye icons + viewer avatar stack
- 2-panel slider: tags (default) + comments (on hover)
- Tags: compact colored pills with hover tooltip (user · date)
- Comments: max 2 lines clamp, full text on hover title
- Date format: current year M/D, last year YY/M/D
- Avatars: only show viewers sorted by count, +N overflow"
```