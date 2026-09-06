import db from '../config/database.js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// ============================================================
// 1. users — 用户表
//   id        自增主键
//   username  登录用户名（唯一）
//   email     邮箱（唯一）
//   password  密码（bcrypt加密）
//   avatar    头像URL
//   avatar_color 头像颜色（用户自选，如 #ff6a00）
//   status    账号状态 1=正常 0=禁用
//   created_at 创建时间
//   updated_at 更新时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    avatar TEXT,
    avatar_color TEXT,
    role TEXT DEFAULT 'user',
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 2. suppliers — 供应商
//   id        UUID主键
//   name      供应商名称（唯一）
//   address   供应商地址
//   memberId  1688会员ID
//   created_at 创建时间
//   updated_at 更新时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    memberId TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 3. tags — 全局标签池
//   id              UUID主键
//   text            标签文字
//   font_color      文字颜色
//   bg_color        背景颜色
//   visibility      可见性 public=所有人可见 private=仅创建者可见
//   creator         创建者用户名
//   creator_id      创建者用户ID
//   created_at      创建时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    font_color TEXT,
    bg_color TEXT,
    visibility TEXT DEFAULT 'public',
    creator TEXT,
    creator_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 4. products — 1688 商品
//   id          自增主键
//   offer_id    1688商品ID
//   title       商品标题
//   main_img_url  产品主图URL
//   supplier_name  供应商名称
//   created_at  创建时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id TEXT,
    title TEXT,
    main_img_url TEXT,
    supplier_name TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 5. system_configs — 系统全局设置
//   id           UUID主键
//   config_key   配置键（唯一）
//   config_value 配置值
//   description  配置说明
//   updated_by   最后修改者用户ID
//   updated_at   更新时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS system_configs (
    id TEXT PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 6. announcements — 公告
//   id           UUID主键
//   title        公告标题
//   content      公告内容
//   status       状态 1=发布 0=草稿
//   published_by 发布者用户ID
//   created_at   创建时间
//   updated_at   更新时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status INTEGER DEFAULT 1,
    published_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 7. user_configs — 用户个人配置
//   id           UUID主键
//   user_id      用户ID
//   config_key   配置键
//   config_value 配置值
//   唯一约束: (user_id, config_key)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS user_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    config_key TEXT NOT NULL,
    config_value TEXT NOT NULL,
    UNIQUE(user_id, config_key)
  )
`)

// ============================================================
// 8. product_comments — 商品评论
//   id        UUID主键
//   offer_id  1688商品ID
//   user_id   评论者用户ID
//   text      评论内容
//   img       评论图片数量
//   created_at 创建时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_comments (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    img INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  )
`)

// ============================================================
// 9. supplier_comments — 供应商评论
//   id          UUID主键
//   supplier_id 供应商ID
//   user_id     评论者用户ID
//   text        评论内容
//   created_at  创建时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_comments (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  )
`)

// ============================================================
// 10. product_tags — 商品↔标签关联
//   id         UUID主键
//   offer_id   1688商品ID
//   tag_id     标签ID
//   tag_user   打标签的用户ID
//   assigned_at 分配时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_tags (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    tag_user TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 11. supplier_tags — 供应商↔标签关联
//   id          UUID主键
//   supplier_id 供应商ID
//   tag_id      标签ID
//   tag_user    打标签的用户ID
//   assigned_at 分配时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_tags (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    tag_user TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 12. view_records — 浏览记录
//   id        UUID主键
//   offer_id  1688商品ID
//   user_id   浏览者用户ID
//   viewed_at 浏览时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS view_records (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 13. product_updates — 产品更新日志
//   id           UUID主键
//   version      版本号
//   title        更新标题
//   content      更新内容（支持HTML）
//   status       状态 published=已发布 draft=草稿
//   created_at   创建时间
//   updated_at   更新时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_updates (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 14. operation_logs — 操作日志
//   id          UUID主键
//   user_id     操作者用户ID
//   username    操作者用户名
//   action      操作类型 (POST /api/xxx)
//   detail      操作详情（可读描述，如"张三给商品CS-B17添加了评论"）
//   ip_address  操作者IP
//   created_at  操作时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 15. product_query_stats — 商品被查询次数
//    独立于 products 表：列表页商品未入库（没人点开过详情页）也照样计数
//   offer_id        1688商品ID（主键）
//   query_count     被查询次数（batch_info 真实查询 +1，前端缓存命中不计数）
//   last_queried_at 最后查询时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_query_stats (
    offer_id TEXT PRIMARY KEY,
    query_count INTEGER DEFAULT 0,
    last_queried_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 兼容旧表：补充新增字段
try { db.exec(`ALTER TABLE operation_logs ADD COLUMN username TEXT`) } catch (e) {}
try { db.exec(`ALTER TABLE operation_logs ADD COLUMN detail TEXT`) } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN avatar_color TEXT`) } catch (e) {}
// 商品被查询次数（插件真实查询 batch_info 时 +1，前端缓存命中不计数）
try { db.exec(`ALTER TABLE products ADD COLUMN query_count INTEGER DEFAULT 0`) } catch (e) {}

console.log('Database initialized successfully — 16 tables created')

// ============================================================
// 种子数据：仅在数据库为空时插入（通过检查 admin 用户判断）
// ============================================================
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('1')
if (adminUser) {
  console.log('Seed data already exists, skipping seed')
} else {
  console.log('Empty database detected, seeding...')

  // --- 管理员 ---
  const hashedPassword = bcrypt.hashSync('1', 10)
  db.prepare(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('1', 'admin@local.com', hashedPassword, 'admin')

  // --- 额外用户 ---
  const extraUsers = [
    { username: 'zhangsan', email: 'zhangsan@local.com', password: bcrypt.hashSync('123456', 10) },
    { username: 'lisi', email: 'lisi@local.com', password: bcrypt.hashSync('123456', 10) },
    { username: 'Conley', email: 'Conley@local.com', password: bcrypt.hashSync('1234', 10) },
    { username: 'Jerry', email: 'Jerry@local.com', password: bcrypt.hashSync('1234', 10) },
    { username: 'Leo', email: 'Leo@local.com', password: bcrypt.hashSync('1234', 10) },
    { username: 'Sam', email: 'Sam@local.com', password: bcrypt.hashSync('1234', 10) },
  ]
  const insertUser = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
  for (const u of extraUsers) {
    insertUser.run(u.username, u.email, u.password)
  }

 

  console.log('Seed data inserted (users + updates)')
}

/**
 * UUID 生成工具
 */
export function generateId() {
  return crypto.randomUUID()
}

export default db
