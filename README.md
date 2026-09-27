# ALOCS-1688 采购助手

一款运行在 1688 网站上的 **Chrome 浏览器扩展（Manifest V3）**，支持 **单机 / 多人共享双模式**：

- **单机模式**（默认）：装上即用，数据全部保存在本机浏览器（IndexedDB），不需要任何服务器
- **多人共享模式**（可选）：在设置页填写团队服务器地址，成员之间共享商品笔记与浏览动态，减少重复看货、重复沟通

> 打开 1688，一眼就知道这个商品自己或同事有没有看过、备注过什么。

## 功能特性

### 商品详情页浮窗（Win）

注入 `detail.1688.com/offer/*`，可拖拽、位置自动记忆，内含三个 Tab：

- **商品**：富文本笔记编辑器（自动保存）+ 团队成员笔记列表
- **供应商**：供应商笔记 + 团队成员的供应商笔记
- **数据**：累计浏览/出现统计、近 7/14/30 天趋势图（可叠加他人曲线）、浏览时段分布、**浏览时间轴**（谁在什么时候看过，滚到底自动刷新）

### 商品卡片注入（Box）

在以下页面的每张商品卡片下方注入信息条：

- **搜索列表页**（s.1688.com / search.1688.com）
- **供应商店铺页**（店铺二级域名不固定，shop 前缀 / 自定义域名均可，React fiber 识别卡片）
- **以图搜图页 / 首页推荐**

卡片内容：

- 出现次数（列表刷出 +1）/ 浏览次数（点进详情页 +1）
- 同供应商已看商品数、近 30 天出现/浏览双图
- 多人模式下：他人浏览计数、**团队留言**卡片
- **「跳转商品」链接**：没有链接的商品也能凭商品编号一键打开详情页

### 管理后台

浏览器扩展页直接打开，免登录：

- **我的货源**：微信式左右分栏，左侧供应商列表、右侧商品行，右侧滑出详情抽屉
- **存储管理**：IndexedDB 用量、容量上限、过期清理、备份导出 / 导入
- **系统设置**：服务器连接（地址 / 昵称 / 共享开关 / 同步方式）、1688 页面渲染开关

### 多人共享与隐私

- **免注册**：填昵称即可连接，身份令牌由扩展自动生成
- **共享需明确同意**：打开「共享我的数据」开关后才上传；不共享也能查看他人数据
- **三个展示开关**：是否显示他人笔记、是否显示他人浏览数量、是否在列表页显示
- **同步方式可选**：自动同步（间隔 1 / 3 / 5 / 10 / 15 分钟）或仅手动

## 技术栈

| 层级 | 技术 |
|------|------|
| 扩展框架 | WXT ^0.20 |
| 前端 | Vue 3（组合式 API）+ Pinia + Element Plus + ECharts + wangEditor |
| 本地存储 | IndexedDB（扩展 background 统一持有） |
| 共享后端 | Express + better-sqlite3（SQLite，免注册免登录） |

## 目录结构

```
wxt_1688/
├── wxt/                # Chrome 扩展主项目
│   ├── entrypoints/
│   │   ├── background.js            # Service Worker：本地数据中枢 + 同步调度
│   │   ├── popup/                   # 工具栏弹窗（昵称、入口）
│   │   ├── admin/                   # 管理后台（我的货源/设置等）
│   │   ├── win/                     # 详情页浮窗（Vue Router 三 Tab）
│   │   ├── box/                     # 列表卡片注入 UI
│   │   ├── box-content.content.js   # 卡片注入（挂载 UI）
│   │   └── win-content.content.js   # 详情页浮窗注入
│   ├── stores/                      # Pinia：api / auth / dom
│   └── utils/
│       ├── localdb.js               # IndexedDB 封装与建表
│       ├── localapi.js              # 本地接口路由（含他人数据合并）
│       ├── remoteClient.js          # 多人共享同步层
│       └── dataClient.js            # 页面脚本调用本地接口的客户端
├── server/             # 多人共享后端（Express + SQLite）
│   └── src/routes/v1/   # clients（注册）/ sync（push、pull）/ updates
├── CHANGELOG.md         # 版本更新记录
├── PROJECT.md           # 详细项目文档
└── CLAUDE.md            # AI 协作开发规范
```

## 快速开始

### 单机模式（最简单）

```bash
cd wxt
npm install
npm run build
```

然后 Chrome 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `wxt/.output/chrome-mv3` 即可，数据只存在本机。

### 多人共享模式

```bash
# 1. 启动团队服务器（任选一台常开的电脑，默认 :3000）
cd server
npm install
npm run dev

# 2. 每个成员构建扩展
cd ../wxt && npm install && npm run build

# 3. 扩展加载后：管理页 → 系统设置 → 服务器连接
#    - 服务器电脑本机填 http://localhost:3000
#    - 同一局域网其他成员填 http://<服务器局域网IP>:3000，如 http://192.168.1.100:3000
#    - 填昵称 → 连接并注册 → 打开「共享我的数据」
```

> 服务器需对局域网开放 3000 端口；成员电脑需与服务器在同一局域网。

## 常用命令

```bash
# 扩展（wxt/）
npm run dev          # 开发模式（热更新，日志全开）
npm run build        # 构建
npm run compile      # vue-tsc 类型检查
npm run zip          # 打包 zip

# 后端（server/）
npm run dev          # 热重载（nodemon）
npm start            # 生产模式
```

## 相关文档

- [CHANGELOG.md](./CHANGELOG.md) — 版本更新记录
- [PROJECT.md](./PROJECT.md) — 详细项目文档
- [CLAUDE.md](./CLAUDE.md) — AI 协作开发规范
