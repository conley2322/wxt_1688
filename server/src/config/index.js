// 服务端配置：端口 / SQLite 文件路径均可被环境变量覆盖
export const config = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './data/database.sqlite',
}
