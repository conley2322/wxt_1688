# 1688 采购助手 — 项目文档

## 项目概述

1688 采购助手是一款 **Chrome 浏览器扩展**，专为 1688 采购团队设计。通过在 1688 商品详情页和搜索列表页注入协作面板，团队成员可以对商品和供应商进行**评论、打标签、记录浏览历史**，实现团队采购协作。

- **产品名称**：1688 助手 / 1688 采购助手
- **类型**：Chrome 扩展 (Manifest V3) + Node.js 后端
- **框架**：WXT + Vue 3 + Pinia + Element Plus
- **后端**：Express + SQLite (better-sqlite3)
- **目标站点**：`detail.1688.com`、`s.1688.com`、`search.1688.com`

---

## 项目结构

```
1688/
├── PROJECT.md                     # 本文档
├── package.json                   # 根依赖 (echarts, pinia, vue-router)
├── CLAUDE.md                      # AI 助手指令
│
├── wxt/                           # ⭐ Chrome 扩展主项目 (WXT 框架)
│   ├── wxt.config.js              # WXT 配置 (别名、权限、代理)
│   ├── tsconfig.json
│   ├── package.json
│   │
│   ├── entrypoints/               # 扩展入口点
│   │   ├── background.ts          # Service Worker 后台脚本
│   │   ├── popup/                 # 🔹 浏览器工具栏弹窗 (登录入口)
│   │   │   ├── App.vue            # 登录/已登录主页
│   │   │   ├── index.html
│   │   │   └── main.js
│   │   ├── admin/                 # 🔹 管理后台页面 (独立 Tab)
│   │   │   ├── App.vue            # 侧边栏 + 概览/商品/标签/评论/设置
│   │   │   ├── index.html
│   │   │   └── main.js
│   │   ├── box/                   # 🔹 搜索列表页卡片注入 (content script)
│   │   │   ├── App.vue            # 商品卡片增强（信息、标签、评论）
│   │   │   ├── hs-card/           # 卡片子组件
│   │   │   │   ├── HsInfoCardV5.vue   # 信息卡片容器
│   │   │   │   ├── HsAvatarStack.vue  # 头像栈（浏览用户）
│   │   │   │   ├── HsCommentList.vue  # 评论列表（紧凑）
│   │   │   │   ├── HsTagsPanel.vue    # 标签面板（紧凑）
│   │   │   │   └── index.js
│   │   │   ├── index.html
│   │   │   └── main.js
│   │   ├── box-content.content.js # 🔸 搜索列表页注入脚本
│   │   ├── win/                   # 🔹 商品详情页浮窗 (content script)
│   │   │   ├── App.vue            # 浮窗主布局（产品概览 + Tab）
│   │   │   ├── router.js          # 前端路由 (/product, /supplier)
│   │   │   ├── index.html
│   │   │   ├── main.js
│   │   │   ├── components/        # 浮窗组件
│   │   │   │   ├── DraggableWindow.vue  # 可拖拽窗口容器
│   │   │   │   ├── BackBar.vue
│   │   │   │   ├── CommentInput.vue     # 评论输入框
│   │   │   │   ├── CommentItem.vue      # 评论项
│   │   │   │   ├── InputSettings.vue    # 标签创建设置
│   │   │   │   ├── TagChip.vue
│   │   │   │   ├── TagCloud.vue         # 标签云展示
│   │   │   │   ├── TagCreator.vue
│   │   │   │   ├── TagPool.vue          # 标签池（可用/已分配）
│   │   │   │   ├── UserFilter.vue       # 用户筛选
│   │   │   │   └── composables/
│   │   │   │       └── useWindowDrag.js
│   │   │   └── pages/
│   │   │       ├── product/
│   │   │       │   └── comment.vue      # 商品评论+标签页
│   │   │       ├── supplier/
│   │   │       │   └── comment.vue      # 供应商评论+标签+合作标记
│   │   │       └── settings/
│   │   │           └── index.vue
│   │   └── win-content.content.js  # 🔸 商品详情页注入脚本
│   │
│   ├── components/                 # 共用组件
│   │   ├── HsAvatarStack.vue       # 头像栈
│   │   ├── HsCommentList.vue       # 评论列表（紧凑版）
│   │   ├── HsTagsPanel.vue         # 标签面板（紧凑版）
│   │   └── HelloWorld.vue
│   │
│   ├── stores/                     # Pinia 状态管理
│   │   ├── auth.js                 # 认证 Store（登录/Token/请求）
│   │   ├── api/api.js              # API Store（标签/评论/浏览数据 + ajax）
│   │   └── dom.js                  # DOM Store（1688 页面抓取）
│   │
│   ├── utils/
│   │   ├── storage.js              # 存储工具（browser.storage / localStorage）
│   │   ├── ajax.js                 # Ajax 封装
│   │   └── stopLoading.js          # 停止 1688 页面加载动画
│   │
│   ├── assets/                     # 静态资源
│   ├── public/icon/                # 扩展图标 (16/32/48/96/128)
│   └── .output/                    # 构建产物
│       ├── chrome-mv3/             # 生产构建
│       └── chrome-mv3-dev/         # 开发构建
│
├── server/                         # ⭐ Express 后端服务
│   ├── index.js                    # 入口：启动 HTTP 服务 (默认 :3000)
│   ├── package.json
│   ├── src/
│   │   ├── app.js                  # Express 应用主文件
│   │   ├── config/
│   │   │   ├── index.js            # 服务配置 (端口、CORS)
│   │   │   └── database.js         # SQLite 数据库连接
│   │   ├── database/
│   │   │   └── init.js             # 数据库初始化 (16表 + 种子数据)
│   │   ├── middlewares/
│   │   │   ├── index.js            # 中间件统一导出
│   │   │   ├── auth/index.js       # JWT 认证中间件
│   │   │   ├── logger/index.js     # 请求日志中间件
│   │   │   └── errorHandler/index.js # 错误处理中间件
│   │   ├── routes/
│   │   │   ├── index.js            # 路由总入口 /api
│   │   │   └── v1/
│   │   │       ├── index.js        # v1 路由入口 /api/v1
│   │   │       ├── users/          # 用户模块 /api/v1/users/**
│   │   │       │   ├── index.js
│   │   │       │   ├── login.js        # POST 登录
│   │   │       │   ├── getUsers.js     # GET 用户列表
│   │   │       │   ├── createUser.js   # POST 创建用户
│   │   │       │   ├── getUserById.js  # GET 单个用户
│   │   │       │   ├── updateUser.js   # PUT 更新用户
│   │   │       │   └── deleteUser.js   # DELETE 删除用户
│   │   │       ├── product/        # 商品模块 /api/v1/products/**
│   │   │       │   ├── index.js
│   │   │       │   ├── Product_browsing_history.js  # POST 记录浏览
│   │   │       │   ├── Product_list.js              # POST 添加商品
│   │   │       │   └── box/
│   │   │       │       └── Product_get_box_info.js  # GET 商品摘要
│   │   │       ├── tags/           # 标签模块 /api/v1/tags/**
│   │   │       │   ├── index.js
│   │   │       │   ├── tag_my_add.js   # 添加我的标签
│   │   │       │   └── tag_my_get.js   # 获取我的标签
│   │   │       └── win/            # 浮窗模块 /api/v1/win/**
│   │   │           ├── index.js
│   │   │           └── product_get_my_tag.js  # GET 商品标签
│   │   ├── controllers/
│   │   ├── services/
│   │   └── utils/
│   │       └── index.js
│   └── data/
│       └── database.sqlite         # SQLite 数据库文件
│
├── docs/                           # 文档目录
├── .output/                        # 根构建产物
├── .codegraph/                     # CodeGraph 代码索引
└── skills-lock.json
```

---

## 架构概览

```
┌─────────────────────────────────────────────────┐
│              1688.com 页面                       │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐    │
│  │  搜索列表页   │    │    商品详情页          │    │
│  │ s.1688.com   │    │ detail.1688.com      │    │
│  │              │    │                      │    │
│  │ box-content  │    │   win-content        │    │
│  │ 注入卡片增强  │    │   注入协作浮窗         │    │
│  └──────┬───────┘    └──────────┬───────────┘    │
│         │                       │                │
│         └───────────┬───────────┘                │
│                     │                            │
│              ┌──────▼──────┐                     │
│              │  Popup 弹窗  │                     │
│              │ (登录入口)   │                     │
│              └──────┬──────┘                     │
│                     │                            │
│              ┌──────▼──────┐                     │
│              │ Admin 管理   │                     │
│              │ (独立页面)   │                     │
│              └──────┬──────┘                     │
└─────────────────────┼───────────────────────────┘
                      │ HTTP (fetch)
              ┌───────▼────────┐
              │  Express API   │
              │  :3000         │
              │  /api/v1/*     │
              │                │
              │  JWT 认证      │
              │  SQLite 存储   │
              └────────────────┘
```

---

## 入口点 (Entrypoints) 详解

### 1. Popup（工具栏弹窗）
- **触发方式**：点击浏览器工具栏的扩展图标
- **功能**：用户登录 / 已登录主页
- **文件**：`wxt/entrypoints/popup/App.vue`
- **关键能力**：
  - 输入服务器地址 + 账号密码登录
  - 登录状态持久化至 `browser.storage.local`
  - 已登录后可跳转 Admin 管理后台
  - 退出登录清除 Token

### 2. Admin（管理后台）
- **触发方式**：Popup 中点击「管理后台」按钮
- **功能**：独立 Tab 页面的后台管理
- **文件**：`wxt/entrypoints/admin/App.vue`
- **导航**：概览 → 商品管理 → 标签管理 → 评论管理 → 系统设置
- **当前状态**：除概览外的子页面均为占位状态（"即将上线"）

### 3. Box（搜索列表卡片增强）
- **触发方式**：自动注入 `s.1688.com/selloffer/*` 和 `search.1688.com/selloffer/*`
- **功能**：在 1688 搜索结果页每个商品卡片上叠加协作信息
- **实现**：Content Script (`box-content.content.js`) 创建 Vue 实例挂载到每个卡片
- **展示内容**：浏览统计、标签、评论（紧凑卡片样式）
- **关键逻辑**：通过 `data-renderkey` / `data-aplus-report` / `href` 提取 `offer_id`

### 4. Win（商品详情页浮窗）
- **触发方式**：自动注入 `detail.1688.com/offer/*`
- **功能**：在 1688 商品详情页右侧显示可拖拽的协作浮窗
- **文件**：`wxt/entrypoints/win/`
- **架构**：
  - `DraggableWindow` — 可拖拽容器
  - 产品概览区（图片 + 标题 + 供应商 + 浏览统计）
  - Tab 导航：商品 / 供应商 / 分析
  - 子页面：评论 + 标签（商品和供应商各自独立）
  - 使用 Vue Router (Memory History) 进行 Tab 切换
  - 使用 Pinia + Element Plus

---

## 前端 Store 说明

### authStore (`stores/auth.js`)
- **登录管理**：服务器地址、用户名、Token
- **核心方法**：
  - `login(server, user, password)` — 登录并持久化
  - `logout()` — 清除认证信息
  - `restoreSession()` — 从 storage 恢复
  - `request(path, options)` — 通用 API 请求（自动带 Token）

### apiStore (`stores/api/api.js`)
- **核心数据**：
  - `userTagPool` — 全局标签池
  - `productAssignedTags` / `supplierAssignedTags` — 已分配标签
  - `productComments` / `supplierComments` — 评论列表
  - `supplierCooperated` — 合作标记
- **核心方法**：
  - 标签 CRUD（创建/删除/分配/移除/点赞）
  - 评论 CRUD（添加/修改/删除/点赞）
  - `ajax(url, method, body)` — 带认证的 API 请求
- **当前状态**：大量 mock 数据，部分通过 ajax 连接后端

### domStore (`stores/dom.js`)
- **功能**：从 1688 页面 DOM 抓取数据
- **抓取字段**：公司名称、地址、商品标题、主图 URL、商品 ID
- **适配多种页面布局**：普通工厂档案、超级工厂档案、工厂首页、商品页面

---

## 后端 API 路由表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/v1/users/login` | 无 | 用户登录，返回 JWT Token |
| GET | `/api/v1/users` | 无 | 获取用户列表 |
| POST | `/api/v1/users` | 无 | 创建用户 |
| GET | `/api/v1/users/:id` | 无 | 获取单个用户 |
| PUT | `/api/v1/users/:id` | 无 | 更新用户 |
| DELETE | `/api/v1/users/:id` | 无 | 删除用户 |
| POST | `/api/v1/products/Product_browsing_history` | JWT | 记录商品浏览 |
| POST | `/api/v1/products/Product_list` | JWT | 添加商品评论 |
| GET | `/api/v1/products/Product_get_box_info` | JWT | 获取商品摘要信息 |
| POST | `/api/v1/tags/tag_my_add` | JWT | 添加我的标签 |
| GET | `/api/v1/tags/tag_my_get` | JWT | 获取我的标签 |
| GET | `/api/v1/win/get_product_my_tag` | JWT | 获取商品标签（我的+其他人） |

---

## 数据库表结构

共 16 张表：

| # | 表名 | 用途 |
|---|------|------|
| 1 | `users` | 用户表（username, email, bcrypt密码） |
| 2 | `suppliers` | 供应商（name, address, memberId） |
| 3 | `tags` | 全局标签池（text, font_color, bg_color, visibility） |
| 4 | `products` | 1688 商品（offer_id, title, main_img_url） |
| 5 | `system_configs` | 系统全局配置 |
| 6 | `announcements` | 系统公告 |
| 7 | `user_configs` | 用户个人配置 |
| 8 | `product_comments` | 商品评论 |
| 9 | `supplier_comments` | 供应商评论 |
| 10 | `product_tags` | 商品↔标签关联 |
| 11 | `supplier_tags` | 供应商↔标签关联 |
| 12 | `view_records` | 浏览记录 |
| 13 | `supplier_cooperations` | 供应商合作标记 |
| 14 | `product_comment_images` | 商品评论图片 |
| 15 | `supplier_comment_images` | 供应商评论图片 |
| 16 | `operation_logs` | 操作日志 |

**默认管理员账号**：`1` / `1`

---

## 技术栈速览

| 层级 | 技术 | 版本 |
|------|------|------|
| 扩展框架 | WXT | ^0.20.26 |
| 前端框架 | Vue 3 | ^3.5.29 |
| 状态管理 | Pinia | ^3.0.4 |
| UI 组件库 | Element Plus | ^2.14.1 |
| 路由 | Vue Router | ^5.0.7 |
| 图表 | ECharts | ^6.1.0 |
| 后端框架 | Express | ^4.18.2 |
| 数据库 | better-sqlite3 | ^12.10.0 |
| 认证 | jsonwebtoken + bcryptjs | - |
| 语言 | JavaScript (ES Module) | - |

---

## 开发命令

```bash
# === 安装依赖 ===
npm install              # 根目录
cd wxt && npm install    # Chrome 扩展
cd server && npm install # 后端服务

# === 开发模式 ===
cd wxt && npm run dev         # WXT 开发模式 (Chrome)
cd wxt && npm run dev:firefox # WXT 开发模式 (Firefox)
cd server && npm run dev      # 后端热重载 (nodemon)

# === 构建 ===
cd wxt && npm run build       # 生产构建
cd wxt && npm run zip         # 打包为 .zip

# === 后端启动 ===
cd server && npm start        # 生产模式启动
```

---

## 已知问题 & 注意事项

1. **端口不一致**：WXT 配置 `host_permissions` 指向 `localhost:3001`，但服务器默认监听 `3000`，需要统一
2. **认证覆盖不全**：`/api/v1/users/*` 路由未启用 JWT 认证中间件，`/api/v1/products/*`、`/api/v1/tags/*`、`/api/v1/win/*` 已启用
3. **前端 Mock 数据**：`apiStore` 中存在大量硬编码的 mock 数据，部分功能（评论、标签）仍在本地操作，未完全接入后端 API
4. **Admin 面板**：商品管理、标签管理、评论管理、系统设置子页面均为占位状态
5. **box-content 硬编码 Token**：`box/App.vue` 中存在硬编码的 JWT Token 和服务地址
6. **数据库已初始化**：首次启动服务器会自动建表和填充种子数据，无需手动迁移
