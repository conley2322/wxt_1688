# 1688 Chrome 扩展项目

## 语言要求
你都必须用中文回复。思考内容也要使用中文。
# 服务器路由新建文件夹结构规范
1. 路由文件夹采用版本控制结构，`routes/index.js` 作为总入口创建 `express.Router()` 并挂载各版本路由，每个版本（如 `v1/`、`v2/`）独立一个文件夹，文件夹内必须有 `index.js` 作为该版本路由入口，负责创建 `express.Router()` 并注册该版本所有接口；
2. 每个业务模块（如 `users/`、`hello/`）独立成文件夹，每个具体接口独立成文件；
3. 每个路由文件采用**自包含模式**：自身创建 `Router`、定义路由、`export default router`，示例：
   ```js
   import { Router } from 'express'
   const router = Router()
   router.get('/', (req, res) => {
     // 处理逻辑
   })
   export default router
   ```
   **路由文件内部路径统一写 `/`**，实际路径由外层的 `router.use()` 挂载决定。
4. 模块 `index.js` 使用一行式加载子路由：
   ```js
   router.use('/path', (await import('./file.js')).default)  // METHOD /api/v1/module/path
   ```
   每行**必须写注释**标明该接口的完整 API 地址。
5. 每层 `index.js` 也使用同样的一行式，如 `v1/index.js`：
   ```js
   router.use('/users', (await import('./users/index.js')).default)    // /api/v1/users/**
   ```
6. 每个中间件独立一个文件夹，通过 index.js 统一导出；
7. 数据库实例在 app.js 中通过中间件挂载到 `req.db` 上，提供 `query`（查多条）、`get`（查单条）、`run`（增删改）三个方法，路由文件中直接使用 `req.db` 调用，无需导入，SQL 语句和参数直接传入即可。