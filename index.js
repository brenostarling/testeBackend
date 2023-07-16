require('dotenv').config()
const express = require('express')
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')
const database = require('./db')
const boletosRoutes = require('./rest_api/boletosAPI')
const lotesRoutes = require('./rest_api/lotesAPI')
const app = express()
const port = process.env.SERVER_PORT || 3000;

// Opções de configuração do Swagger
const options = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API Documentation',
            version: '1.0.0',
        },
    },
    apis: ['./rest_api/*.js'],
}
const specs = swaggerJsdoc(options)

// Middlewares e rotas da API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))
app.use(express.json())
app.use('/boletos', boletosRoutes)
app.use('/lotes', lotesRoutes)

// Iniciando a conexão com o banco de dados e sincronizando os modelos
database.sync()
    .then(() => {
        console.log('Conexão com o banco de dados estabelecida com sucesso.')

        // Inicie o servidor da API
        app.listen(port, () => {
            console.log(`Servidor iniciado em http://localhost:${port}`)
        })
    })
    .catch((error) => {
        console.error('Erro ao conectar-se ao banco de dados:', error)
    })
