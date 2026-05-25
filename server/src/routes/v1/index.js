import express from 'express'

const router = express.Router()

// ── users 模块 ──
import { getUsers } from './users/getUsers.js'
import { getUserById } from './users/getUserById.js'
import { createUser } from './users/createUser.js'
import { updateUser } from './users/updateUser.js'
import { deleteUser } from './users/deleteUser.js'
import { login } from './users/login.js'
router.post('/users/login', login)
router.get('/users', getUsers)
router.get('/users/:id', getUserById)
router.post('/users', createUser)
router.put('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)

 // ── products 模块 ──
 import { recordProductView } from './product/Product_browsing_history.js'
 router.get('/products/Product_browsing_history/:offerId', recordProductView)

export default router
