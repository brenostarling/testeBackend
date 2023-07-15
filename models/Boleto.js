const Sequelize = require('sequelize')
const database = require('../db')
const Lote = require('./Lote')

const Boleto = database.define('Boleto', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    nome_sacado: {
        type: Sequelize.STRING(255),
        allowNull: true,
    },
    id_lote: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: Lote,
            key: 'id',
        },
    },
    valor: {
        type: Sequelize.DECIMAL,
        allowNull: false,
    },
    linha_digitavel: {
        type: Sequelize.STRING(255),
        allowNull: true,
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

Boleto.belongsTo(Lote, { foreignKey: 'id_lote' })

module.exports = Boleto
