const fs = require('fs')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

async function createFakePDF () {
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const names = ['JOSE DA SILVA', 'MARCOS ROBERTO', 'MARCIA CARVALHO']

    for (let i = 0; i < names.length; i++) {
        const name = names[i]
        const page = pdfDoc.addPage()

        const { width, height } = page.getSize()
        const fontSize = 24

        page.drawText(name, {
            x: 50,
            y: height / 2,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
        })
    }

    const pdfBytes = await pdfDoc.save()
    fs.writeFileSync('TodosBoletos.pdf', pdfBytes)
}

createFakePDF()
    .then(() => console.log('PDF fake criado com sucesso.'))
    .catch((error) => console.error('Erro ao criar o PDF fake:', error))
