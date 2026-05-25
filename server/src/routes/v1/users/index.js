import { Router } from 'express'
const router = Router()

router.use('/login', (await import('./login.js')).default)       // POST /api/v1/users/login
router.use('/', (await import('./getUsers.js')).default)          // GET /api/v1/users
router.use('/', (await import('./createUser.js')).default)        // POST /api/v1/users
router.use('/:id', (await import('./getUserById.js')).default)    // GET /api/v1/users/:id
router.use('/:id', (await import('./updateUser.js')).default)     // PUT /api/v1/users/:id
router.use('/:id', (await import('./deleteUser.js')).default)     // DELETE /api/v1/users/:id

export default router