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
//   visibility      可见性(public/hidden)
//   creator         创建者
//   added_by        添加者
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
    added_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 4. products — 1688 商品
//   id        自增主键
//   offer_id  1688商品ID
//   title     商品标题
//   main_img_url  产品主图URL
//   created_at 创建时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id TEXT,
    title TEXT,
    main_img_url TEXT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 10. product_tags — 商品↔标签关联
//   id         UUID主键
//   offer_id   1688商品ID
//   tag_id     标签ID
//   visible    是否可见 1=显示 0=隐藏
//   tag_user   打标签的用户ID
//   assigned_at 分配时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_tags (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    visible INTEGER DEFAULT 1,
    tag_user TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 11. supplier_tags — 供应商↔标签关联
//   id          UUID主键
//   supplier_id 供应商ID
//   tag_id      标签ID
//   visible     是否可见 1=显示 0=隐藏
//   tag_user    打标签的用户ID
//   assigned_at 分配时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_tags (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    visible INTEGER DEFAULT 1,
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
// 13. supplier_cooperations — 供应商合作标记
//   id            UUID主键
//   supplier_id   供应商ID
//   user_id       用户ID
//   cooperated_at 合作标记时间
//   唯一约束: (supplier_id, user_id)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_cooperations (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cooperated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, user_id)
  )
`)

// ============================================================
// 14. product_comment_images — 商品评论图片
//   id          UUID主键
//   comment_id  商品评论ID
//   file_name   原始文件名
//   file_path   存储路径
//   file_size   文件大小（字节）
//   uploaded_by 上传者用户ID
//   created_at  上传时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS product_comment_images (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 15. supplier_comment_images — 供应商评论图片
//   id          UUID主键
//   comment_id  供应商评论ID
//   file_name   原始文件名
//   file_path   存储路径
//   file_size   文件大小（字节）
//   uploaded_by 上传者用户ID
//   created_at  上传时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_comment_images (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ============================================================
// 16. operation_logs — 操作日志
//   id          UUID主键
//   user_id     操作者用户ID
//   action      操作类型 (login/logout/create/update/delete 等)
//   target_type 操作对象类型 (product/tag/comment 等)
//   target_id   操作对象ID
//   detail      操作详情
//   ip_address  操作者IP
//   created_at  操作时间
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    detail TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

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
    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
  ).run('1', 'admin@local.com', hashedPassword)

  // --- 额外用户 ---
  const extraUsers = [
    { username: 'zhangsan', email: 'zhangsan@local.com', password: bcrypt.hashSync('123456', 10) },
    { username: 'lisi', email: 'lisi@local.com', password: bcrypt.hashSync('123456', 10) },
  ]
  const insertUser = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
  const userIds = [db.prepare('SELECT id FROM users WHERE username = ?').get('1').id]
  for (const u of extraUsers) {
    insertUser.run(u.username, u.email, u.password)
    userIds.push(db.prepare('SELECT id FROM users WHERE username = ?').get(u.username).id)
  }

  // --- 供应商 ---
  const suppliers = [
    { id: generateId(), name: '义乌市创意五金有限公司', address: '浙江省义乌市稠城街道福田路88号', memberId: 'b2b-290190276977744' },
    { id: generateId(), name: '深圳市光明塑料制品厂', address: '广东省深圳市光明新区公明街道', memberId: 'b2b-290190276977745' },
    { id: generateId(), name: '东莞市汇丰包装材料有限公司', address: '广东省东莞市厚街镇家具大道12号', memberId: 'b2b-290190276977746' },
  ]
  const insertSupplier = db.prepare('INSERT INTO suppliers (id, name, address, memberId) VALUES (?, ?, ?, ?)')
  for (const s of suppliers) {
    insertSupplier.run(s.id, s.name, s.address, s.memberId)
  }

  // --- 商品 ---
  const products = [
    { offer_id: '900667592522', title: '不锈钢户外水壶 750ml' },
    { offer_id: '89012346', title: '便携式折叠帐篷 3-4人款' },
    { offer_id: '89012347', title: '铝合金登山杖 碳素伸缩' },
    { offer_id: '89012348', title: '多功能野营炊具套装' },
  ]
  const productIds = []
  for (const p of products) {
    const info = db.prepare('INSERT INTO products (offer_id, title) VALUES (?, ?)').run(p.offer_id, p.title)
    productIds.push(info.lastInsertRowid)
  }

  // --- 标签池 ---
  const tags = [
    { text: '优质供应商', font_color: '#fff', bg_color: '#2ecc71' },
    { text: '需议价', font_color: '#fff', bg_color: '#faad14' },
    { text: '已下单', font_color: '#fff', bg_color: '#1890ff' },
    { text: '样品待确认', font_color: '#fff', bg_color: '#722ed1' },
    { text: '质量有问题', font_color: '#fff', bg_color: '#f5222d' },
  ]
  const insertTag = db.prepare('INSERT INTO tags (id, text, font_color, bg_color, visibility, creator, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const tagIds = []
  for (const t of tags) {
    const id = generateId()
    insertTag.run(id, t.text, t.font_color, t.bg_color, 'public', 'Conley', 'Conley', '2026-05-30T13:22:29Z')
    tagIds.push(id)
  }

  // --- 系统配置 ---
  const configs = [
    { key: 'site_name', value: '1688采购助手', desc: '站点名称' },
    { key: 'max_upload_size', value: '5242880', desc: '最大上传文件大小（字节）' },
    { key: 'default_page_size', value: '20', desc: '默认分页大小' },
  ]
  const insertConfig = db.prepare('INSERT INTO system_configs (id, config_key, config_value, description, updated_by) VALUES (?, ?, ?, ?, ?)')
  for (const c of configs) {
    insertConfig.run(generateId(), c.key, c.value, c.desc, String(userIds[0]))
  }

  // --- 公告 ---
  const announcements = [
    { title: '系统上线通知', content: '1688采购助手系统已正式上线，欢迎大家使用！', status: 1 },
    { title: '数据迁移说明', content: '旧系统数据已完成迁移，如有问题请联系管理员。', status: 1 },
    { title: '新功能预告', content: '即将上线批量导入商品功能，敬请期待。', status: 0 },
  ]
  const insertAnnouncement = db.prepare('INSERT INTO announcements (id, title, content, status, published_by) VALUES (?, ?, ?, ?, ?)')
  for (const a of announcements) {
    insertAnnouncement.run(generateId(), a.title, a.content, a.status, String(userIds[0]))
  }

  // --- 用户个人配置 ---
  const userConfigs = [
    { user_idx: 0, key: 'theme', value: 'light' },
    { user_idx: 0, key: 'language', value: 'zh-CN' },
    { user_idx: 1, key: 'theme', value: 'dark' },
  ]
  const insertUserConfig = db.prepare('INSERT INTO user_configs (id, user_id, config_key, config_value) VALUES (?, ?, ?, ?)')
  for (const uc of userConfigs) {
    insertUserConfig.run(generateId(), String(userIds[uc.user_idx]), uc.key, uc.value)
  }

  // --- 商品评论 ---
  const productComments = [
    { product_idx: 0, user_idx: 0, text: '质量不错，厚度适中，户外使用很方便。' },
    { product_idx: 0, user_idx: 1, text: '发货速度很快，包装完好，值得推荐。' },
    { product_idx: 1, user_idx: 0, text: '帐篷搭建简单，防风效果一般，性价比高。' },
    { product_idx: 2, user_idx: 2, text: '登山杖手感好，伸缩顺滑，重量可以接受。' },
    { product_idx: 3, user_idx: 1, text: '炊具套装很齐全，就是锅底容易粘。' },
  ]
  const pcIds = []
  for (const pc of productComments) {
    const id = generateId()
    db.prepare('INSERT INTO product_comments (id, offer_id, user_id, text) VALUES (?, ?, ?, ?)')
      .run(id, products[pc.product_idx].offer_id, String(userIds[pc.user_idx]), pc.text)
    pcIds.push(id)
  }

  // --- 供应商评论 ---
  const supplierComments = [
    { supplier_idx: 0, user_idx: 0, text: '合作三年，交期稳定，价格公道。' },
    { supplier_idx: 0, user_idx: 1, text: '偶尔有质量问题，但售后处理及时。' },
    { supplier_idx: 1, user_idx: 0, text: '塑料制品质量过硬，模具精度高。' },
    { supplier_idx: 2, user_idx: 2, text: '包装材料种类丰富，可以一站式采购。' },
  ]
  const insertSC = db.prepare('INSERT INTO supplier_comments (id, supplier_id, user_id, text) VALUES (?, ?, ?, ?)')
  const scIds = []
  for (const sc of supplierComments) {
    const id = generateId()
    insertSC.run(id, suppliers[sc.supplier_idx].id, String(userIds[sc.user_idx]), sc.text)
    scIds.push(id)
  }

  // --- 商品标签关联 ---
  const productTagPairs = [
    { product_idx: 0, tag_idx: 0 },
    { product_idx: 0, tag_idx: 2 },
    { product_idx: 1, tag_idx: 3 },
    { product_idx: 2, tag_idx: 0 },
    { product_idx: 3, tag_idx: 1 },
    { product_idx: 3, tag_idx: 4 },
  ]
  for (const pt of productTagPairs) {
    db.prepare('INSERT INTO product_tags (id, offer_id, tag_id, tag_user) VALUES (?, ?, ?, ?)')
      .run(generateId(), products[pt.product_idx].offer_id, tagIds[pt.tag_idx], String(userIds[0]))
  }

  // --- 供应商标签关联 ---
  const supplierTagPairs = [
    { supplier_idx: 0, tag_idx: 0 },
    { supplier_idx: 0, tag_idx: 2 },
    { supplier_idx: 1, tag_idx: 0 },
    { supplier_idx: 2, tag_idx: 1 },
  ]
  const insertST = db.prepare('INSERT INTO supplier_tags (id, supplier_id, tag_id, tag_user) VALUES (?, ?, ?, ?)')
  for (const st of supplierTagPairs) {
    insertST.run(generateId(), suppliers[st.supplier_idx].id, tagIds[st.tag_idx], String(userIds[0]))
  }

  // --- 浏览记录 ---
  const viewRecords = [
    { product_idx: 0, user_idx: 0 },
    { product_idx: 0, user_idx: 1 },
    { product_idx: 1, user_idx: 0 },
    { product_idx: 1, user_idx: 2 },
    { product_idx: 2, user_idx: 1 },
    { product_idx: 3, user_idx: 0 },
    { product_idx: 3, user_idx: 2 },
  ]
  for (const vr of viewRecords) {
    db.prepare('INSERT INTO view_records (id, offer_id, user_id) VALUES (?, ?, ?)')
      .run(generateId(), products[vr.product_idx].offer_id, String(userIds[vr.user_idx]))
  }

  // --- 供应商合作标记 ---
  const cooperations = [
    { supplier_idx: 0, user_idx: 0 },
    { supplier_idx: 1, user_idx: 0 },
    { supplier_idx: 0, user_idx: 1 },
  ]
  const insertCoop = db.prepare('INSERT INTO supplier_cooperations (id, supplier_id, user_id) VALUES (?, ?, ?)')
  for (const c of cooperations) {
    insertCoop.run(generateId(), suppliers[c.supplier_idx].id, String(userIds[c.user_idx]))
  }

  // --- 商品评论图片 ---
  const pcImages = [
    { pc_idx: 0, name: '水壶实物图.jpg', path: '/uploads/2026/05/shuihu_01.jpg', size: 204800, user_idx: 0 },
    { pc_idx: 2, name: '帐篷搭建效果.jpg', path: '/uploads/2026/05/tent_01.jpg', size: 358400, user_idx: 0 },
  ]
  const insertPCI = db.prepare('INSERT INTO product_comment_images (id, comment_id, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
  for (const img of pcImages) {
    insertPCI.run(generateId(), pcIds[img.pc_idx], img.name, img.path, img.size, String(userIds[img.user_idx]))
  }

  // --- 供应商评论图片 ---
  const scImages = [
    { sc_idx: 0, name: '工厂实拍.jpg', path: '/uploads/2026/05/factory_01.jpg', size: 512000, user_idx: 0 },
  ]
  const insertSCI = db.prepare('INSERT INTO supplier_comment_images (id, comment_id, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
  for (const img of scImages) {
    insertSCI.run(generateId(), scIds[img.sc_idx], img.name, img.path, img.size, String(userIds[img.user_idx]))
  }

  // --- 操作日志 ---
  const logs = [
    { user_idx: 0, action: 'login', target_type: 'user', target_id: null, detail: '管理员登录', ip: '127.0.0.1' },
    { user_idx: 0, action: 'create', target_type: 'product', target_id: String(productIds[0]), detail: '添加商品：不锈钢户外水壶', ip: '127.0.0.1' },
    { user_idx: 1, action: 'login', target_type: 'user', target_id: null, detail: '用户登录', ip: '192.168.1.100' },
    { user_idx: 0, action: 'create', target_type: 'tag', target_id: tagIds[0], detail: '创建标签：优质供应商', ip: '127.0.0.1' },
    { user_idx: 2, action: 'create', target_type: 'comment', target_id: pcIds[3], detail: '发表商品评论', ip: '10.0.0.50' },
  ]
  const insertLog = db.prepare('INSERT INTO operation_logs (id, user_id, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)')
  for (const l of logs) {
    insertLog.run(generateId(), String(userIds[l.user_idx]), l.action, l.target_type, l.target_id, l.detail, l.ip)
  }

  console.log('Seed data inserted for all 16 tables')
}

// ============================================================
// 数据迁移：将 view_records.user_id 从 TEXT 改为 INTEGER
// ============================================================
const viewRecordsColumnInfo = db.prepare("PRAGMA table_info(view_records)").all()
const userIdColumnType = viewRecordsColumnInfo.find(col => col.name === 'user_id')?.type
if (userIdColumnType === 'TEXT') {
  console.log('Migrating view_records.user_id from TEXT to INTEGER...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS view_records_new (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  db.exec(`INSERT INTO view_records_new SELECT id, offer_id, CAST(user_id AS INTEGER), viewed_at FROM view_records`)
  db.exec(`DROP TABLE view_records`)
  db.exec(`ALTER TABLE view_records_new RENAME TO view_records`)
  console.log('Migration complete: view_records.user_id is now INTEGER')
}

/**
 * UUID 生成工具
 */
export function generateId() {
  return crypto.randomUUID()
}

export default db
