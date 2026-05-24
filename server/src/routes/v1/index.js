import express from 'express'
import { getUsers } from './users/getUsers.js'
import { getUserById } from './users/getUserById.js'
import { createUser } from './users/createUser.js'
import { updateUser } from './users/updateUser.js'
import { deleteUser } from './users/deleteUser.js'
import { login } from './users/login.js'
import { hello } from './hello/hello.js'

const router = express.Router()

// users 模块
router.post('/users/login', login)
router.get('/users', getUsers)
router.get('/users/:id', getUserById)
router.post('/users', createUser)
router.put('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)

// hello 模块
router.get('/hello', hello)
// product 模块
import { getProduct } from './product/get_product.js'
router.get('/products/:id', getProduct)// 获取商品详情 完整请求地址 /api/v1/products/:id

export default router
