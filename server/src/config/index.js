export default {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost',
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
}
