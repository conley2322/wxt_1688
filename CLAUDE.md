# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

1688 采购助手浏览器扩展 + 后端服务。用于在 1688 商品详情页和搜索结果页注入协作 UI（评论、标签、浏览统计）。

### 两条命令

```bash
# 后端
cd server && npm run dev    # nodemon 热重载启动 (port 3000)

# 前端扩展 (WXT)
cd wxt && npm run dev       # wxt dev 模式
cd wxt && npm run build     # 构建生产包
cd wxt && npm run zip       # 打包 .zip
cd wxt && npm run compile   # vue-tsc 类型检查
```

单测：该项目暂无测试框架。

## Architecture

### 双项目结构

```
wxt_1688/
├── server/          # Express.js 后端 (API + SQLite)
│   ├── src/app.js           # Express 入口，挂载 cors/json/logger/db 中间件
│   ├── src/config/          # database.js (better-sqlite3) + index.js (端口/CORS)
│   ├── src/database/init.js # users 表建表
│   ├── src/routes/v1/       # 路由模块：users CRUD、login(JWT)、product、hello
│   ├── src/utils/           # responseSuccess / responseError 工具函数
│   └── data/database.sqlite # SQLite 数据文件 (gitignored)
│
└── wxt/              # WXT 浏览器扩展 (Vue 3 + Pinia + WXT v0.20)
    ├── wxt.config.js         # WXT 配置，Vue 模块 + host_permissions
    ├── entrypoints/
    │   ├── background.ts     # Service Worker (占位)
    │   ├── popup/            # 浏览器工具栏弹窗 (登录页 + 主页)
    │   ├── admin/            # 管理页面 (占位)
    │   ├── win/              # 详情页注入的主窗口 (Vue Router + DraggableWindow)
    │   │   ├── App.vue       # 主布局：产品概览 + Tab导航 + router-view
    │   │   ├── router.js     # 6个路由：product/comment, product/tag, supplier/comment, supplier/tag, analysis/views, analysis/records
    │   │   └── pages/        # 各页面组件
    │   ├── win-content.content.js   # 注入到 detail.1688.com/offer/* 的 content script
    │   ├── box-content.content.js   # 注入到 s.1688.com/selloffer/* 搜索结果页
    │   └── box/              # 搜索结果页内联 UI (标签/评论/浏览悬浮面板)
    ├── stores/
    │   ├── api/api.js        # 核心数据 store：标签池、评论、浏览统计、供应商状态
    │   ├── auth.js           # 登录状态 store (browser.storage 持久化，当前 mock)
    │   └── dom.js            # DOM 数据采集 store (从 1688 页面提取公司名/地址/商品标题/图片)
    └── components/           # 共享组件：HsAvatarStack, HsTagsPanel, HsCommentList
```

### 数据流

1. **content script** (`win-content.content.js`) 在用户访问 1688 商品详情页时注入 Vue 应用
2. DOM store (`dom.js`) 通过 CSS 选择器抓取页面上的商品名、供应商名称、图片、产品ID
3. API store (`api/api.js`) 管理所有业务数据（当前全部为前端 mock 数据）
4. Auth store (`auth.js`) 管理登录会话（当前 mock，预留了 fetch 后端 API 的代码）
5. 后端 (`server/`) 提供了完整的 JWT 登录 + users CRUD + product 查询 API，但前端暂未对接

### 关键约定

- **两个 content script 注入点**：商品详情页 (`detail.1688.com/offer/*`) 使用 `createIntegratedUi` 挂载 DraggableWindow；搜索结果页 (`s.1688.com/selloffer/*`) 使用 MutationObserver 监听列表变化，在每个商品卡片上注入迷你信息面板
- **UI 组件风格**：所有组件使用 scoped style，无 UI 框架依赖
- **窗口位置持久化**：DraggableWindow 的 position/size/dotMode 通过 `browser.storage.local` 保存
- **标签系统**：全局标签池 → 分配到商品/供应商，支持创建/编辑/删除/可见性切换
- **评论系统**：支持排序（最新/最早）、按用户筛选、点赞

### 预设的 mock 数据

- `api.js` 中包含预设的商品评论、供应商评论、浏览数据、标签池
- `box/App.vue` 中的搜索结果页数据基于 offerId 确定性随机生成（seeded random）
- 后端目前可提供 product 查询 API `GET /api/v1/products/:id` (从 SQLite 查 products 表)