const fs = require('fs');
const path = require('path');
const ExcelJS = require(path.join(__dirname, '../../node_modules/.pnpm/exceljs@4.4.0/node_modules/exceljs'));
const PDFDocument = require(path.join(__dirname, '../../node_modules/.pnpm/pdfkit@0.15.2/node_modules/pdfkit'));

const outDir = '/tmp/export-test';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const companies = [
  { name: 'Barbearia do Joao', category: 'Barbearia', phone: '+55 11 99999-0001', email: 'joao@barbearia.com', website: 'https://barbeariadojoao.com', instagram: 'barbeariadojoao', facebook: 'barbeariadojoao', city: 'Sao Paulo', state: 'SP', rating: 4.5, totalRatings: 120, enrichedData: { qualityScore: 85, presenceLevel: 'HIGH' }, googleMapsLink: 'https://maps.google.com/?q=Barbearia+do+Joao' },
  { name: 'Padaria Pao Quente', category: 'Padaria', phone: '+55 21 98888-0002', email: 'contato@paoquente.com', website: 'https://paoquente.com', instagram: 'paoquente', facebook: null, city: 'Rio de Janeiro', state: 'RJ', rating: 3.2, totalRatings: 45, enrichedData: { qualityScore: 45, presenceLevel: 'LOW' }, googleMapsLink: 'https://maps.google.com/?q=Padaria+Pao+Quente' },
];

async function main() {
  const xlsxPath = path.join(outDir, 'test.xlsx');
  const pdfPath = path.join(outDir, 'test.pdf');

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Leads');
  sheet.columns = [
    { header: 'Nome', key: 'name', width: 30 },
    { header: 'Categoria', key: 'category', width: 18 },
    { header: 'Telefone', key: 'phone', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Website', key: 'website', width: 28 },
    { header: 'Instagram', key: 'instagram', width: 22 },
    { header: 'Cidade', key: 'city', width: 20 },
    { header: 'Avaliacao', key: 'rating', width: 12 },
    { header: 'Score IA', key: 'qualityScore', width: 12 },
    { header: 'Nivel Presenca', key: 'presenceLevel', width: 16 },
    { header: 'Link Maps', key: 'googleMapsLink', width: 40 },
  ];
  for (const c of companies) {
    sheet.addRow({ name: c.name, category: c.category, phone: c.phone, email: c.email, website: c.website, instagram: c.instagram, city: c.city, rating: c.rating, qualityScore: c.enrichedData.qualityScore, presenceLevel: c.enrichedData.presenceLevel, googleMapsLink: c.googleMapsLink });
  }
  await wb.xlsx.writeFile(xlsxPath);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const ws = fs.createWriteStream(pdfPath);
  doc.pipe(ws);
  doc.fontSize(18).text('LeadHunter AI - Leads Exportados', { align: 'center' });
  doc.moveDown();
  for (const c of companies) {
    doc.fontSize(11).text(c.name + ' | ' + c.category + ' | Score: ' + c.enrichedData.qualityScore);
    doc.fontSize(9).text('Tel: ' + (c.phone||'N/A') + ' | Email: ' + (c.email||'N/A'));
    doc.moveDown(0.3);
  }
  doc.end();
  await new Promise(r => ws.on('finish', r));

  console.log('xlsx: ' + xlsxPath + ' = ' + fs.statSync(xlsxPath).size + ' bytes');
  console.log('pdf:  ' + pdfPath + ' = ' + fs.statSync(pdfPath).size + ' bytes');
  console.log('SUCCESS: Both files generated');
}
main().catch(e => { console.error(e); process.exit(1); });
