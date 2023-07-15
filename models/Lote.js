const Sequelize = require('sequelize')
const database = require('../db')

const Lote = database.define('Lote', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    nome: {
        type: Sequelize.STRING(100),
        allowNull: false,
    },
    ativo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
    criado_em: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
})

module.exports = Lote
