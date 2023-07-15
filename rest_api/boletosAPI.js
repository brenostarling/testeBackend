const Sequelize = require('sequelize')
const sequelize = require('../db')
const express = require('express')
const multer = require('multer')
const csvParser = require('csv-parser')
const PDFParser = require('pdf-parse')
const { base64 } = require('base64-js')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const JSZip = require('jszip')
const fs = require('fs')
const Boleto = require('../models/Boleto')
const Lote = require('../models/Lote')
const router = express.Router()

// Configuração do Multer para receber o arquivo CSV
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})
const upload = multer({ storage })

/**
 * @swagger
 * /import:
 *   post:
 *     summary: Importa boletos a partir de um arquivo CSV
 *     tags:
 *       - Boletos
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Arquivo CSV contendo os dados dos boletos
 *     responses:
 *       200:
 *         description: Boletos importados com sucesso
 *       400:
 *         description: Erro ao importar os boletos do arquivo CSV
 */
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        const boletos = []

        fs.createReadStream(req.file.path)
            .pipe(csvParser({ separator: ';' }))
            .on('data', (data) => {
                boletos.push(data)
            })
            .on('end', async () => {

                // Vou buscar todos os lotes que já existem, e os que não existem irei criar
                const lotesNomes = boletos.map(boleto => boleto.unidade.padStart(4, '0'))
                const lotesExistentes = await Lote.findAll({ where: { nome: { [Sequelize.Op.in]: lotesNomes } } })
                const lotesExistentesNomes = lotesExistentes.map(lote => lote.nome)
                const lotesInexistentesNomes = lotesNomes.filter(nome => !lotesExistentesNomes.includes(nome))
                const lotesCriados = await Lote.bulkCreate(lotesInexistentesNomes.map(nome => ({ nome })), { returning: true })
                const todosLotes = lotesExistentes.concat(lotesCriados)

                // Mapear os boletos para o formato apropriado
                const boletosToCreate = boletos.map((boleto) => {
                    const { nome, unidade, valor, linha_digitavel } = boleto

                    // Formatar o nome do lote com zeros à esquerda
                    const nomeLote = unidade.padStart(4, '0')
                    const lote = todosLotes.find(l => l.nome === nomeLote)

                    return {
                        nome_sacado: nome,
                        id_lote: lote.id,
                        valor,
                        linha_digitavel,
                    }
                })

                // Iniciar uma transação
                const transaction = await sequelize.transaction()

                try {
                    const insertedBoletos = await Boleto.bulkCreate(boletosToCreate, {
                        transaction,
                        returning: true,
                    })

                    await transaction.commit()

                    fs.unlinkSync(req.file.path)
                    res.json(insertedBoletos)
                } catch (error) {
                    await transaction.rollback()
                    throw error
                }
            })
    } catch (error) {
        console.error('Erro ao importar boletos:', error)
        res.status(500).json({ error: 'Erro ao importar boletos' })
    }
})

/**
 * @swagger
 * /uploadpdf:
 *   post:
 *     summary: Recebe e processa o arquivo PDF
 *     tags:
 *       - Boletos
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Arquivo PDF a ser enviado
 *     responses:
 *       200:
 *         description: Arquivo PDF recebido e processado com sucesso
 *       400:
 *         description: Erro ao processar o arquivo PDF
 */
router.post('/uploadpdf', upload.single('file'), async (req, res) => {
    try {
        const pdfBuffer = fs.readFileSync(req.file.path)
        const pdfData = await PDFParser(pdfBuffer)
        const names = pdfData.text.split('\n').filter((name) => name.trim() !== '')
        const boletos = await Boleto.findAll({ where: { nome_sacado: { [Sequelize.Op.in]: names } } })

        const mappedBoletos = boletos.map((boleto) => ({
            id: boleto.id,
            nome_sacado: boleto.nome_sacado,
            id_lote: boleto.id_lote,
            valor: boleto.valor,
            linha_digitavel: boleto.linha_digitavel,
        }))

        // Cria o diretório para os PDFs
        const outputDir = 'pdfs/'
        fs.mkdirSync(outputDir, { recursive: true })
        const zip = new JSZip()

        // Gera os PDFs e adiciona ao arquivo ZIP
        for (let i = 0; i < mappedBoletos.length; i++) {
            const boleto = mappedBoletos[i]
            const pdfPath = `${outputDir}${boleto.id}.pdf`

            // Cria o PDF com os dados do boleto
            const pdfDoc = await PDFDocument.create()
            const page = pdfDoc.addPage()

            const x = 50
            let y = page.getHeight() - 50
            const lineHeight = 20
            page.drawText(`Nome Sacado: ${boleto.nome_sacado}`, { x, y })
            y -= lineHeight
            page.drawText(`Valor: ${boleto.valor}`, { x, y })
            y -= lineHeight
            page.drawText(`Linha Digitável: ${boleto.linha_digitavel}`, { x, y })
            const pdfBytes = await pdfDoc.save()

            // Adiciona o PDF ao arquivo ZIP
            zip.file(`${boleto.id}.pdf`, pdfBytes)
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

        // Envia o arquivo ZIP como resposta para download
        const zipFileName = 'boletos.zip'
        res.setHeader('Content-Disposition', `attachment filename=${zipFileName}`)
        res.setHeader('Content-Type', 'application/zip')
        res.send(zipBuffer)

        // Deleta o arquivo temporário, se existir
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
        } else {
            console.error('Arquivo temporário não encontrado:', req.file.path)
        }

        // Deleta os PDFs temporários, se existirem
        for (let i = 0; i < mappedBoletos.length; i++) {
            const boleto = mappedBoletos[i]
            const pdfPath = `${outputDir}${boleto.id}.pdf`

            if (fs.existsSync(pdfPath)) {
                fs.unlinkSync(pdfPath)
            } else {
                console.error('PDF temporário não encontrado:', pdfPath)
            }
        }
    } catch (error) {
        console.error('Erro ao processar os PDFs:', error)
        res.status(500).json({ error: 'Erro ao processar os PDFs' })
    }
})

/**
 * @swagger
 * /boletos:
 *   get:
 *     summary: Retorna todos os boletos
 *     tags:
 *       - Boletos
 *     parameters:
 *       - in: query
 *         name: relatorio
 *         schema:
 *           type: string
 *         description: Parâmetro opcional para gerar um relatório em PDF, retornando como base64
 *       - in: query
 *         name: nome
 *         schema:
 *           type: string
 *         description: Filtra boletos pelo nome do sacado
 *       - in: query
 *         name: valor_inicial
 *         schema:
 *           type: number
 *         description: Filtra boletos com valor igual ou maior que o valor inicial
 *       - in: query
 *         name: valor_final
 *         schema:
 *           type: number
 *         description: Filtra boletos com valor igual ou menor que o valor final
 *       - in: query
 *         name: id_lote
 *         schema:
 *           type: number
 *         description: Filtra boletos pelo ID do lote
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *         description: Campo para ordenação dos boletos
 *       - in: query
 *         name: sortDirection
 *         schema:
 *           type: string
 *         description: Direção da ordenação dos boletos (ascendente ou descendente)
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', async (req, res) => {
    try {
        const isRelatorio = req.query.relatorio === '1';
        const { nome, valor_inicial, valor_final, id_lote } = req.query;

        // Monta o objeto de filtro com base nos parâmetros fornecidos
        const filtro = {};
        if (nome) filtro.nome_sacado = nome;
        if (valor_inicial) filtro.valor = { [Sequelize.Op.gte]: valor_inicial };
        if (valor_final) filtro.valor = { ...filtro.valor, [Sequelize.Op.lte]: valor_final };
        if (id_lote) filtro.id_lote = id_lote;

        const { orderBy, sortDirection } = req.query;
        const order = orderBy && sortDirection ? [[orderBy, sortDirection]] : [];

        // Busca os boletos com base no filtro
        const boletos = await Boleto.findAll({ where: filtro, order });

        if (isRelatorio) {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontSize = 10;
            const lineHeight = 20;
            const margin = 50;
            const maxWidth = page.getWidth() - margin * 2;
            let x = margin;
            let y = page.getHeight() - margin - lineHeight;

            page.drawText('Relatório de Boletos', { x, y, font, fontSize, color: rgb(0, 0, 0) });
            y -= lineHeight * 2;

            const headers = ['ID', 'Nome', 'ID Lote', 'Valor', 'Linha Digitável'];
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                page.drawText(header, { x, y, font, fontSize, color: rgb(0, 0, 0) });
                x += maxWidth / headers.length;
            }

            y -= lineHeight;

            // Adicione os dados dos boletos à tabela
            for (let i = 0; i < boletos.length; i++) {
                const boleto = boletos[i];
                x = margin;

                // Adicione os valores dos campos do boleto
                const values = [
                    boleto.id.toString(),
                    boleto.nome_sacado.toString(),
                    boleto.id_lote.toString(),
                    boleto.valor.toString(),
                    boleto.linha_digitavel.toString()
                ];

                for (let j = 0; j < values.length; j++) {
                    const value = values[j];
                    page.drawText(value, { x, y, font, fontSize, color: rgb(0, 0, 0) });
                    x += maxWidth / values.length;
                }
                y -= lineHeight;
            }

            const pdfBytes = await pdfDoc.save();

            // Converta o buffer em base64
            const base64 = pdfBytes.toString('base64');

            res.status(200).json({ base64 });
        } else {
            // Se não foi solicitado o relatório, retorne os boletos em formato JSON
            res.status(200).json(boletos);
        }
    } catch (error) {
        console.error('Erro ao buscar boletos:', error);
        res.status(500).json({ error: 'Erro ao buscar boletos' });
    }
});

module.exports = router
