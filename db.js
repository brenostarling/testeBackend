require('dotenv').config();
const Sequelize = require('sequelize')

const database = new Sequelize(process.env.DB_NAME || 'postgres', process.env.DB_USER || 'postgres', process.env.DB_PASSWORD || 'postgres', {
    host: process.env.DEV_HOST || 'localhost',
    dialect: process.env.DB || 'postgres',
    port: process.env.DB_PORT || '5432'
});


module.exports = database