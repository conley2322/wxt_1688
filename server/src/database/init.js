import db from '../config/database.js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// 开启外键约束
db.pragma('foreign_keys = ON')

// ============================================================
// 1. users — 用户表
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    color TEXT,
    status INTEGER DEFAULT 1,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 2. suppliers — 供应商
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 3. tags — 全局标签池
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    color TEXT NOT NULL,
    visible INTEGER DEFAULT 1,
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 4. products — 1688 商品
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL UNIQUE,
    title TEXT,
    image_url TEXT,
    supplier_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 5. system_configs — 系统全局设置
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS system_configs (
    id TEXT PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_by TEXT REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 6. announcements — 公告
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status INTEGER DEFAULT 1,
    published_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 7. user_configs — 用户个人配置
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS user_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    config_key TEXT NOT NULL,
    config_value TEXT NOT NULL,
    UNIQUE(user_id, config_key)
  )
`)

// ============================================================
// 8. product_comments — 商品评论
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_comments (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 9. product_comment_likes — 商品评论点赞
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_comment_likes (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL REFERENCES product_comments(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    UNIQUE(comment_id, user_id)
  )
`)

// ============================================================
// 10. supplier_comments — 供应商评论
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_comments (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 11. supplier_comment_likes — 供应商评论点赞
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_comment_likes (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL REFERENCES supplier_comments(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    UNIQUE(comment_id, user_id)
  )
`)

// ============================================================
// 12. product_tags — 商品↔标签关联
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_tags (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    tag_id TEXT NOT NULL REFERENCES tags(id),
    visible INTEGER DEFAULT 1,
    assigned_by TEXT REFERENCES users(id),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 13. supplier_tags — 供应商↔标签关联
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_tags (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    tag_id TEXT NOT NULL REFERENCES tags(id),
    visible INTEGER DEFAULT 1,
    assigned_by TEXT REFERENCES users(id),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 14. view_records — 浏览记录
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS view_records (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 15. supplier_cooperations — 供应商合作标记
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_cooperations (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    cooperated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, user_id)
  )
`)

// ============================================================
// 16. comment_images — 评论图片
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS comment_images (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 17. operation_logs — 操作日志
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    detail TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 索引
// ============================================================
db.exec(`CREATE INDEX IF NOT EXISTS idx_view_records_product ON view_records(product_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_view_records_user ON view_records(user_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_view_records_viewed_at ON view_records(viewed_at)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_comments_product ON product_comments(product_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_supplier_comments_supplier ON supplier_comments(supplier_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON operation_logs(user_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_operation_logs_action ON operation_logs(action)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_comment_images_entity ON comment_images(entity_type, entity_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_tags_product ON product_tags(product_id)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_supplier_tags_supplier ON supplier_tags(supplier_id)`)

console.log('Database initialized successfully — 17 tables created')

// ============================================================
// 兼容性迁移：为已有数据库补充分组字段（如果不存在）
// ============================================================
try { db.exec(`ALTER TABLE product_tags ADD COLUMN visible INTEGER DEFAULT 1`) } catch (e) {}
try { db.exec(`ALTER TABLE supplier_tags ADD COLUMN visible INTEGER DEFAULT 1`) } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`) } catch (e) {}

// ============================================================
// 种子数据：初始管理员（账号 1，密码 1）
// ============================================================
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('1')
if (!adminUser) {
  const id = generateId()
  const hashedPassword = bcrypt.hashSync('1', 10)
  db.prepare(
    'INSERT INTO users (id, username, email, password, color, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, '1', 'admin@local.com', hashedPassword, '#1677ff', 'admin')
  console.log('Seed user created: username=1, password=1')
}

/**
 * UUID 生成工具
 */
export function generateId() {
  return crypto.randomUUID()
}

export default db