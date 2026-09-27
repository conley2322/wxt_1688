// 建表（幂等：已存在则跳过）
const SCHEMAS = [
  // 客户端（昵称免注册：token 由扩展端生成，首次连接 upsert）
  `CREATE TABLE IF NOT EXISTS clients (
    token      TEXT PRIMARY KEY,
    nickname   TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  // 商品（按 1688 offer_id 唯一）
  `CREATE TABLE IF NOT EXISTS products (
    offer_id      TEXT PRIMARY KEY,
    title         TEXT DEFAULT '',
    main_img_url  TEXT DEFAULT '',
    supplier_name TEXT DEFAULT '',
    updated_at    INTEGER NOT NULL
  )`,
  // 浏览流水（点进详情页）。(token, client_row_id) 唯一：客户端重推不重复入库
  `CREATE TABLE IF NOT EXISTS view_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id      TEXT NOT NULL,
    token         TEXT NOT NULL,
    client_row_id INTEGER NOT NULL,
    viewed_at     INTEGER NOT NULL,
    UNIQUE (token, client_row_id)
  )`,
  // 出现流水（列表页刷出）
  `CREATE TABLE IF NOT EXISTS appear_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id      TEXT NOT NULL,
    token         TEXT NOT NULL,
    client_row_id INTEGER NOT NULL,
    appeared_at   INTEGER NOT NULL,
    UNIQUE (token, client_row_id)
  )`,
  // 笔记（UUID 全局唯一，upsert）
  `CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    target     TEXT NOT NULL,
    token      TEXT NOT NULL,
    nickname   TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
  )`,
]

export function initDatabase(database) {
  for (const sql of SCHEMAS) database.exec(sql)
}
