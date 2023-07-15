const express = require('express');
const Lote = require('../models/Lote')

const router = express.Router();

/**
 * @swagger
 * /lotes:
 *   get:
 *     summary: Retorna todos os lotes
 *     tags:
 *       - Lotes
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', async (req, res) => {
    try {
        const lotes = await Lote.findAll();
        res.json(lotes);
    } catch (error) {
        console.error('Erro ao buscar lotes:', error);
        res.status(500).json({ error: 'Erro ao buscar lotes' });
    }
});

module.exports = router;
