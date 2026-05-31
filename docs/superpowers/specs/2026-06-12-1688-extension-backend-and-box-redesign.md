# 1688 采购助手 — 后端接口补全 & Box 卡片重设计

> 日期：2026-06-12 | 状态：已确认

---

## 一、背景

1688 采购助手前端（WXT + Vue3）目前 Win 和 Box 页面大量使用 mock 数据（`apiStore` 中硬编码），未真正接入后端。本次需要补全后端接口，同时精简 Box 搜索列表卡片，让项目「先跑起来」。

## 二、产品定位

> **打开 1688，一眼就知道哪个商品不用点进去。**

插件在 1688 页面上叠加团队协作层——浏览记录自动共享、评论和标签让信息透明，减少团队重复看货、重复沟通。

## 三、核心原则

| # | 决定 |
|---|------|
| 1 | 必须登录才能使用 Win / Box |
| 2 | 所有请求统一用 `apiStore.ajax()`（自动带 Token，读 `browser.storage.local`） |
| 3 | 后端 401 → 前端弹提示"登录已过期，请重新登录" |
| 4 | 供应商用**名称**标识（不是 ID），有评论才入库 |
| 5 | 评论/标签只能修改删除自己的（后端校验 creator） |
| 6 | 标签不做点赞功能 |
| 7 | Box 不做浏览记录上传，Win 做 |
| 8 | Box 一页约 60 个商品，前端 `new Set()` 去重后批量请求，不做防抖 |
| 9 | 标签颜色由用户自己选择（保留颜色选择器） |

## 四、库存入策略

| 表 | 何时写入 |
|----|---------|
| `view_records` | 每次进入 Win 商品详情页 |
| `products` | Win 浏览时 products 表没有该 offer_id → 返回 `need_insert` → 前端额外发一次插入请求 |
| `suppliers` | 用户给供应商发第一条评论时 |
| `tags` | 用户创建标签时 |
| `product_tags` | 用户给商品打标签时 |
| `supplier_tags` | 用户给供应商打标签时 |
| `product_comments` | 用户发评论时 |
| `supplier_comments` | 用户给供应商发评论时 |
| `supplier_cooperations` | 用户切换合作状态时 |

## 五、Box 搜索卡片重新设计

### 5.1 信息精简

Box 卡片只显示以下信息：

```
[🔴小圆点]    👁 15    💬 6    🏷 4    [头像栈]
```

| 元素 | 说明 |
|------|------|
| 小圆点 | 8px，颜色取该商品所有标签中情绪最强烈的一个（红/黄/绿），无标签时灰色 |
| 👁 数字 | 团队浏览次数 |
| 💬 数字 | 评论数量 |
| 🏷 数字 | 标签数量 |
| 头像栈 | 哪些人看过（最多显示 3 个头像 +N） |

### 5.2 砍掉的内容

| 砍掉 | 原因 |
|------|------|
| 标签文字 | 搜索页面空间有限，标签去看 Win 详情页 |
| 评论预览文字 | 评论是点进详情页再看的 |
| 供应商标签/视图切换 | Box 里只显示商品信息 |

### 5.3 批量查询

- 前端收集所有卡片 offer_id → `new Set()` 去重 → POST `/api/v1/products/batch_info`
- 后端返回以 offer_id 为 key 的对象，前端按 key 分发到各卡片

## 六、Win 详情页

**保持现有设计不变。** 结构：

```
┌─ 可拖拽标题栏 ──────────────┐
│  [产品概览：图 + 标题 + 供应商]│
├──────────────────────────────┤
│  商品  |  供应商 （两个 Tab） │
├──────────────────────────────┤
│  标签云 + 评论列表            │
├──────────────────────────────┤
│  [评论/标签输入区]            │
└──────────────────────────────┘
```

功能：标签云、评论列表、评论/标签输入、用户筛选、排序、供应商合作标记。全部接入后端 API。

## 七、Admin 管理后台

只保留一个设置：**Box 默认显示哪个面板**（商品 / 供应商），存储在 `user_configs` 表。现有其他占位页面（商品管理、标签管理、评论管理、系统设置）砍掉。

## 八、后端接口清单

### 8.1 改造接口

| 方法 | 路径 | 改动 |
|------|------|------|
| POST | `/api/v1/products/Product_browsing_history` | 写浏览记录后查 products 表，没有则返回 `{ need_insert: true }` |

### 8.2 新增接口（20个）

#### 商品评论（4个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/products/:offer_id/comments` | 获取评论列表 |
| POST | `/api/v1/products/:offer_id/comments` | 添加评论 |
| PUT | `/api/v1/products/comments/:id` | 修改评论（仅创建者） |
| DELETE | `/api/v1/products/comments/:id` | 删除评论（仅创建者） |

#### 商品标签（3个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/products/:offer_id/tags` | 获取标签列表（mine + others） |
| POST | `/api/v1/products/:offer_id/tags` | 打标签 |
| DELETE | `/api/v1/products/:offer_id/tags/:tag_id` | 移除标签（仅创建者） |

#### 标签池（2个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tags/pool` | 获取全局标签池 |
| POST | `/api/v1/tags` | 创建新标签 |

#### 供应商评论（4个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/suppliers/comments?supplier_name=xxx` | 获取供应商评论列表 |
| POST | `/api/v1/suppliers/comments` | 添加供应商评论（首次自动入库供应商） |
| PUT | `/api/v1/suppliers/comments/:id` | 修改评论（仅创建者） |
| DELETE | `/api/v1/suppliers/comments/:id` | 删除评论（仅创建者） |

#### 供应商标签（3个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/suppliers/tags?supplier_name=xxx` | 获取供应商标签列表 |
| POST | `/api/v1/suppliers/tags` | 打标签 |
| DELETE | `/api/v1/suppliers/tags/:tag_id` | 移除标签（仅创建者） |

#### 供应商合作（1个）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/suppliers/cooperate` | 切换合作状态 |

#### Box 批量查询（1个）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/products/batch_info` | 批量查询多个商品信息 |

#### 商品入库（1个）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/products` | 新增商品到 products 表 |

#### 评论图片（暂不做）

后端表已有 `product_comment_images` 和 `supplier_comment_images`，本次不实现。

## 九、接口 JSON 规范

### 9.1 商品评论 — 列表

```
GET /api/v1/products/:offer_id/comments

返回：
{
  "code": 200,
  "data": [
    {
      "id": "uuid",
      "user_id": "1",
      "username": "Conley",
      "text": "质量不错，厚度适中",
      "created_at": "2026-05-24T10:30:00Z"
    }
  ]
}
```

### 9.2 商品评论 — 添加

```
POST /api/v1/products/:offer_id/comments
Body: { "text": "评论内容" }

返回：
{
  "code": 200,
  "data": {
    "id": "uuid",
    "text": "评论内容",
    "created_at": "2026-05-24T10:30:00Z"
  }
}
```

### 9.3 商品评论 — 修改

```
PUT /api/v1/products/comments/:id
Body: { "text": "修改后内容" }

返回：{ "code": 200, "message": "修改成功" }
```

### 9.4 商品评论 — 删除

```
DELETE /api/v1/products/comments/:id

返回：{ "code": 200, "message": "删除成功" }
```

### 9.5 商品标签 — 列表

```
GET /api/v1/products/:offer_id/tags

返回：
{
  "code": 200,
  "data": {
    "mine": [
      {
        "id": "tag_uuid",
        "text": "已收藏",
        "font_color": "#fff",
        "bg_color": "#2ecc71",
        "assigned_at": "2026-05-24T10:30:00Z"
      }
    ],
    "others": [
      {
        "id": "tag_uuid",
        "text": "优质",
        "font_color": "#fff",
        "bg_color": "#3498db",
        "assigned_at": "2026-05-24T10:30:00Z",
        "creator": "张三"
      }
    ]
  }
}
```

### 9.6 商品标签 — 打标签

```
POST /api/v1/products/:offer_id/tags
Body: { "tag_id": "tag_uuid" }

返回：{ "code": 200, "message": "标签已添加" }
```

### 9.7 商品标签 — 移除

```
DELETE /api/v1/products/:offer_id/tags/:tag_id

返回：{ "code": 200, "message": "标签已移除" }
```

### 9.8 标签池 — 列表

```
GET /api/v1/tags/pool

返回：
{
  "code": 200,
  "data": [
    {
      "id": "tag_uuid",
      "text": "优质供应商",
      "font_color": "#fff",
      "bg_color": "#2ecc71",
      "creator": "Conley",
      "created_at": "2026-05-24T10:30:00Z"
    }
  ]
}
```

### 9.9 标签池 — 创建

```
POST /api/v1/tags
Body: { "text": "新标签", "font_color": "#fff", "bg_color": "#ff6a00", "visibility": "public" }

返回：
{
  "code": 200,
  "data": {
    "id": "uuid",
    "text": "新标签",
    "font_color": "#fff",
    "bg_color": "#ff6a00",
    "visibility": "public",
    "creator": "Conley",
    "created_at": "2026-05-24T10:30:00Z"
  }
}
```

### 9.10 供应商评论 — 列表

```
GET /api/v1/suppliers/comments?supplier_name=义乌市创意五金有限公司

返回：
{
  "code": 200,
  "data": [
    {
      "id": "uuid",
      "user_id": "1",
      "username": "Conley",
      "text": "合作三年，交期稳定",
      "created_at": "2026-05-24T10:30:00Z"
    }
  ]
}
```

### 9.11 供应商评论 — 添加

```
POST /api/v1/suppliers/comments
Body: { "supplier_name": "义乌市创意五金有限公司", "text": "评论内容" }

// 首次评论 → 后端自动创建 supplier 记录

返回：
{
  "code": 200,
  "data": {
    "id": "uuid",
    "text": "评论内容",
    "created_at": "2026-05-24T10:30:00Z"
  }
}
```

### 9.12 供应商标签 — 列表

```
GET /api/v1/suppliers/tags?supplier_name=义乌市创意五金有限公司

返回：
{
  "code": 200,
  "data": {
    "mine": [...],
    "others": [...]
  }
}
```

（结构同商品标签）

### 9.13 供应商标签 — 打标签

```
POST /api/v1/suppliers/tags
Body: { "supplier_name": "义乌市创意五金有限公司", "tag_id": "tag_uuid" }

返回：{ "code": 200, "message": "标签已添加" }
```

### 9.14 供应商合作 — 切换

```
POST /api/v1/suppliers/cooperate
Body: { "supplier_name": "义乌市创意五金有限公司" }

// 已合作 → 取消合作；未合作 → 标记合作

返回：{ "code": 200, "data": { "cooperated": true } }
```

### 9.15 Box 批量查询

```
POST /api/v1/products/batch_info
Body: { "offer_ids": ["900667592522", "89012346"] }

返回：
{
  "code": 200,
  "data": {
    "900667592522": {
      "view_count": 12,
      "comment_count": 3,
      "tag_count": 4,
      "viewers": [
        { "username": "Conley", "initial": "C", "count": 5 },
        { "username": "张三", "initial": "张", "count": 3 }
      ],
      "i_have_viewed": true
    },
    "89012346": {
      "view_count": 0,
      "comment_count": 0,
      "tag_count": 0,
      "viewers": [],
      "i_have_viewed": false
    }
  }
}
```

### 9.16 商品入库

```
POST /api/v1/products
Body: { "offer_id": "900667592522", "title": "不锈钢户外水壶", "main_img_url": "https://...", "supplier_name": "义乌市创意五金有限公司" }

返回：{ "code": 200, "message": "商品已入库" }
```

### 9.17 browsing_history 改造

```
POST /api/v1/products/Product_browsing_history
Body: { "offer_id": "900667592522" }

返回（商品已存在）：
{ "code": 200, "message": "浏览记录添加成功", "id": "uuid" }

返回（商品不存在）：
{ "code": 200, "message": "浏览记录添加成功", "id": "uuid", "need_insert": true }
```

## 十、后端文件结构

```
server/src/routes/v1/
├── index.js                               # 已有，新增 supplier 模块挂载
├── users/                                 # 已有，不变
│   └── ...
├── products/
│   ├── index.js                           # 已有，新增子路由挂载
│   ├── Product_browsing_history.js         # 改造
│   ├── Product_list.js                     # 已有
│   ├── product_create.js                   # 新增 POST /api/v1/products
│   ├── product_comments/
│   │   ├── index.js
│   │   ├── product_comment_list.js         # GET
│   │   ├── product_comment_add.js          # POST
│   │   ├── product_comment_update.js       # PUT
│   │   └── product_comment_delete.js       # DELETE
│   ├── product_tags/
│   │   ├── index.js
│   │   ├── product_tag_list.js             # GET
│   │   ├── product_tag_add.js              # POST
│   │   └── product_tag_remove.js           # DELETE
│   └── box/
│       ├── Product_get_box_info.js         # 已有
│       └── product_batch_info.js           # 新增 POST
├── suppliers/                              # 新增整个模块
│   ├── index.js
│   ├── supplier_comments/
│   │   ├── index.js
│   │   ├── supplier_comment_list.js
│   │   ├── supplier_comment_add.js
│   │   ├── supplier_comment_update.js
│   │   └── supplier_comment_delete.js
│   ├── supplier_tags/
│   │   ├── index.js
│   │   ├── supplier_tag_list.js
│   │   ├── supplier_tag_add.js
│   │   └── supplier_tag_remove.js
│   └── supplier_cooperate/
│       ├── index.js
│       └── supplier_cooperate_toggle.js
├── tags/
│   ├── index.js                            # 已有，新增子路由
│   ├── tag_my_add.js                       # 已有
│   ├── tag_my_get.js                       # 已有
│   ├── tag_pool.js                         # 新增 GET
│   └── tag_create.js                       # 新增 POST
└── win/
    ├── index.js                            # 已有
    └── product_get_my_tag.js               # 已有
```

## 十一、前端 apiStore 改造要点

`stores/api/api.js` 需要：

1. **删除全部 mock 数据**：`userTagPool`、`productAssignedTags`、`supplierAssignedTags`、`productComments`、`supplierComments` 的初始值改为空数组
2. **所有方法改为调 API**：`addProductComment()` → `ajax('/products/:id/comments', 'POST', { text })`，其他同理
3. **Win 页面 onMounted 流程**：
   ```
   调 browsing_history → 检查 need_insert → 如有则调 POST /products
   → fetchProductComments → fetchProductTags → 渲染
   ```
4. **Box 页面 render 流程**：
   ```
   收集 offer_ids → new Set() → POST batch_info → 按 offer_id 分发
   ```
5. **401 处理**：`ajax()` 中检测 `res.status === 401` → 弹提示

## 十二、不做的

| 项目 | 状态 |
|------|------|
| 标签点赞 | 砍掉 |
| 评论图片上传 | 暂不做（后端表已建） |
| Admin 商品/标签/评论/设置管理页 | 砍掉（只保留 Box 开关） |
| 分析 Tab | 砍掉（空的） |
| Win 页面结构改动 | 维持现状 |
| 标签颜色选择器 | 保留 |

## 十三、数据库变更

`products` 表新增 `supplier_name` 字段：

```sql
ALTER TABLE products ADD COLUMN supplier_name TEXT;
```

同时更新 `server/src/database/init.js` 的建表语句，在 `main_img_url` 后增加 `supplier_name TEXT`。

---

## 十四、实施顺序

| 步骤 | 内容 |
|------|------|
| 1 | 补后端接口（20个新 + 1个改造） |
| 2 | 改前端 apiStore（删 mock，接 API） |
| 3 | Win 组件对接后端 |
| 4 | Box 卡片精简 + 批量接口对接 |
| 5 | 供应商 Tab 对接后端 |
| 6 | Admin Box 开关设置 |
