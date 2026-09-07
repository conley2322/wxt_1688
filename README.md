# ALOCS-1688 采购助手

一款面向 1688 采购团队的 **Chrome 浏览器扩展（Manifest V3）+ Node.js 后端**。在 1688 的商品详情页、搜索列表页、供应商店铺页、以图搜图页面上叠加团队协作层——浏览记录、评论、标签、查询次数团队共享，减少重复看货、重复沟通。

> 打开 1688，一眼就知道哪个商品不用点进去。

## 功能特性

### 商品详情页（Win 浮窗）
- 注入 `detail.1688.com/offer/*`，可拖拽协作浮窗
- 自动记录团队浏览记录，展示"谁看过、看过几次"
- 商品 / 供应商两级评论与标签协作

### 商品卡片注入（Box）
- **搜索列表页**（s.1688.com / search.1688.com）
- **供应商店铺页**（店铺首页 + 全部商品页，shop 前缀 / 自定义域名均可）
- **以图搜图页**（air.1688.com 以图搜款结果）
- **www.1688.com 首页推荐**
- 每张商品卡片展示：浏览数、评论数、标签数、团队头像栈
- **box1 查询统计卡片**：商品被查询次数（按用户统计）、上次查询时间、谁查询了多少次（ECharts 柱状图 / 折线图）、最近一周查询时间轴

### 管理后台
- 概览 / 用户 / 商品 / 供应商 / 标签 / 更新日志（时间轴）/ 系统设置
- 可配置：页面渲染开关、查询次数显示模式（团队总次数 / 仅我的）、图表样式（柱状 / 折线）

## 技术栈

| 层级 | 技术 |
|------|------|
| 扩展框架 | WXT ^0.20 |
| 前端 | Vue 3 + Pinia + Element Plus + ECharts |
| 后端 | Express + better-sqlite3 + JWT |

## 目录结构

```
wxt_1688/
├── wxt/                # Chrome 扩展主项目
│   └── entrypoints/
│       ├── background.ts          # API 代理（解决 HTTPS 页面访问 HTTP 服务）
│       ├── popup/                 # 工具栏弹窗（登录入口）
│       ├── admin/                 # 管理后台页面
│       ├── win/ + win-content.content.js   # 商品详情页浮窗
│       ├── box/ + box-content.content.js   # 商品卡片注入（隔离世界：挂载 UI）
│       └── box-scan.content.js             # 店铺页卡片扫描（主世界：React fiber 识别）
├── server/             # Express 后端（API + SQLite）
│   └── src/routes/v1/  # users / products / suppliers / tags / updates / operations
├── docs/superpowers/   # 历史设计文档
├── CHANGELOG.md        # 版本更新记录
└── PROJECT.md          # 详细项目文档
```

## 快速开始

```bash
# 1. 安装依赖
npm install && cd wxt && npm install && cd ../server && npm install && cd ..

# 2. 启动后端（默认 :3000，首次启动自动建表 + 种子账号）
cd server && npm run dev

# 3. 构建扩展（测试包，保留 console 日志）
cd wxt && npm run build

# 4. 浏览器加载扩展
#    扩展管理页 → 开发者模式 → 加载已解压的扩展程序 → 选择 wxt/.output/chrome-mv3
```

默认管理员账号：`1` / `1`（在扩展弹窗中填入后端地址如 `192.168.x.x:3000` 登录）。

## 常用命令

```bash
cd wxt
npm run dev          # 扩展开发模式（日志全开，热更新）
npm run build        # 测试打包（保留 console）
npm run build:prod   # 生产打包（移除 console）

cd server
npm run dev          # 后端热重载（nodemon）
npm start            # 后端生产模式
```

## 版本发布流程

1. 更新 `wxt/package.json` 的 `version`
2. 在 `CHANGELOG.md` 顶部添加本节更新内容
3. 提交并打标签：`git tag vx.y.z && git push origin main --tags`
4. 创建 GitHub Release（`gh release create vx.y.z`）
5. 在管理后台"更新日志"发布对应的版本记录

## 分支规范

- `main`：稳定发布分支，只在发版或确认合入时更新
- `feature/*`：功能开发分支，完成后合入 main

## 相关文档

- [PROJECT.md](./PROJECT.md) — 详细项目文档（架构、入口点、数据流、接口）
- [CHANGELOG.md](./CHANGELOG.md) — 版本更新记录
- [CLAUDE.md](./CLAUDE.md) — AI 协作开发规范
