// db 中间件：启动时建表，并把 query/get/run 三个方法挂到 req.db
import { db } from '../../config/database.js'
import { initDatabase } from '../../database/init.js'

initDatabase(db)

export function dbMiddleware(req, _res, next) {
  req.db = {
    query: (sql, ...params) => db.prepare(sql).all(...params),
    get: (sql, ...params) => db.prepare(sql).get(...params),
    run: (sql, ...params) => db.prepare(sql).run(...params),
  }
  // 事务等高级用法需要原始实例
  req.rawDb = db
  next()
}
