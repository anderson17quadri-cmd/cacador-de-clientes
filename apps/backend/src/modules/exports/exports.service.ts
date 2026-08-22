import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import * as PDFDocumentLib from 'pdfkit';
const PDFDocument = (PDFDocumentLib as any).default || PDFDocumentLib;
import { PrismaService } from '../../database/prisma.service';
import { CreateExportDto } from './dto/export.dto';
import { ExportFormat } from '../../common/enums';
import { deserializeCompany, stringifyJson } from '../../common/utils/json-fields';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';
import { EXPORT_MAX_ROWS } from '../../common/constants';

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private exportsDir(): string {
    return path.join(this.config.get<string>('dataDir', '.'), 'uploads', 'exports');
  }

  async create(userId: string, dto: CreateExportDto) {
    const fileName = `export-${userId}-${Date.now()}`;
    const format = dto.format || ExportFormat.CSV;

    const exportRecord = await this.prisma.dataExport.create({
      data: {
        userId,
        searchId: dto.searchId,
        format,
        fileName,
        filters: stringifyJson(dto.filters || {}),
        status: 'processing',
      },
    });

    this.processExport(exportRecord.id, userId).catch((error: any) => {
      this.logger.error(`Exportação ${exportRecord.id} falhou: ${error.message}`);
      this.failExport(exportRecord.id, error.message);
    });

    return exportRecord;
  }

  async findAll(userId: string, page: number, limit: number) {
    const { skip, take } = getPaginationParams({ page, limit });
    const [data, total] = await Promise.all([
      this.prisma.dataExport.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataExport.count({ where: { userId } }),
    ]);
    return { data, meta: createPaginationMeta(total, page, take) };
  }

  async findById(id: string) {
    const record = await this.prisma.dataExport.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Exportação não encontrada');
    return record;
  }

  async processExport(exportId: string, userId: string) {
    const record = await this.prisma.dataExport.findUnique({ where: { id: exportId } });
    if (!record) return;

    const where: any = {};
    if (record.searchId) {
      where.searchId = record.searchId;
    } else {
      where.search = { userId };
    }

    const companies = (
      await this.prisma.company.findMany({
        where,
        take: EXPORT_MAX_ROWS,
        orderBy: { createdAt: 'desc' },
        include: { enrichedData: true },
      })
    ).map(deserializeCompany);

    const exportDir = this.exportsDir();
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    const ext = record.format.toLowerCase();
    const filePath = path.join(exportDir, `${record.fileName}.${ext}`);

    switch (record.format) {
      case 'JSON':
        fs.writeFileSync(filePath, JSON.stringify(companies, null, 2));
        break;
      case 'CSV':
        fs.writeFileSync(filePath, this.generateCSV(companies));
        break;
      case 'EXCEL':
        await this.generateExcel(filePath, companies);
        break;
      case 'PDF':
        await this.generatePDF(filePath, companies);
        break;
      default:
        fs.writeFileSync(filePath, JSON.stringify(companies, null, 2));
    }

    const stats = fs.statSync(filePath);

    await this.prisma.dataExport.update({
      where: { id: exportId },
      data: {
        status: 'completed',
        fileSize: stats.size,
        fileUrl: `/api/exports/${exportId}/download`,
        completedAt: new Date(),
      },
    });
  }

  async failExport(exportId: string, error: string) {
    await this.prisma.dataExport.update({
      where: { id: exportId },
      data: { status: 'failed' },
    });
  }

  async download(id: string, res: Response) {
    const record = await this.prisma.dataExport.findUnique({ where: { id } });
    if (!record || !record.fileUrl) throw new NotFoundException('Arquivo não encontrado');

    const ext = record.format.toLowerCase();
    const filePath = path.join(this.exportsDir(), `${record.fileName}.${ext}`);

    if (!fs.existsSync(filePath)) throw new NotFoundException('Arquivo não encontrado no servidor');

    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    };

    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}.${ext}"`);
    res.download(filePath);
  }

  private generateCSV(companies: any[]): string {
    const headers = [
      'Nome', 'Categoria', 'Telefone', 'WhatsApp', 'Email', 'Website',
      'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube',
      'Endereço', 'Cidade', 'Estado', 'CEP', 'País',
      'Latitude', 'Longitude', 'Avaliação', 'Qtd Avaliações',
      'Score IA', 'Presença Digital', 'Tem Site', 'Tem Instagram', 'Tem WhatsApp', 'Tem Email',
    ];

    const rows = companies.map((c) => [
      c.name, c.category, c.phone, c.whatsapp, c.email, c.website,
      c.instagram, c.facebook, c.linkedin, c.tiktok, c.youtube,
      c.address, c.city, c.state, c.postalCode, c.country,
      c.latitude, c.longitude, c.rating, c.totalRatings,
      c.enrichedData?.qualityScore || '', c.enrichedData?.presenceLevel || '',
      c.hasWebsite, c.hasInstagram, c.hasWhatsapp, c.hasEmail,
    ]);

    const escape = (val: any) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    return [
      headers.join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n');
  }

  private async generateExcel(filePath: string, companies: any[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads');

    sheet.columns = [
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Categoria', key: 'category', width: 18 },
      { header: 'Telefone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Website', key: 'website', width: 28 },
      { header: 'Instagram', key: 'instagram', width: 22 },
      { header: 'Facebook', key: 'facebook', width: 22 },
      { header: 'Cidade', key: 'city', width: 20 },
      { header: 'Avaliação', key: 'rating', width: 12 },
      { header: 'Total Avaliações', key: 'totalRatings', width: 16 },
      { header: 'Score IA', key: 'qualityScore', width: 12 },
      { header: 'Nível Presença', key: 'presenceLevel', width: 16 },
      { header: 'Link Maps', key: 'googleMapsLink', width: 40 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    for (const c of companies) {
      sheet.addRow({
        name: c.name || '',
        category: c.category || '',
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        instagram: c.instagram || '',
        facebook: c.facebook || '',
        city: [c.city, c.state].filter(Boolean).join(', ') || '',
        rating: c.rating ?? '',
        totalRatings: c.totalRatings ?? '',
        qualityScore: c.enrichedData?.qualityScore ?? '',
        presenceLevel: c.enrichedData?.presenceLevel ?? '',
        googleMapsLink: c.googleMapsLink || '',
      });
    }

    await workbook.xlsx.writeFile(filePath);
  }

  private async generatePDF(filePath: string, companies: any[]): Promise<void> {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(18).font('Helvetica-Bold').text('LeadHunter AI - Leads Exportados', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(
      `Exportado em: ${new Date().toLocaleString('pt-BR')}  |  Total: ${companies.length} empresas`,
      { align: 'center' },
    );
    doc.moveDown(1);

    const colX = [50, 220, 320, 380, 440, 500];
    const drawTableHeader = (y: number) => {
      doc.rect(50, y - 4, 500, 20).fill('#7C3AED');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      doc.text('Nome', colX[0]!, y, { width: 160 });
      doc.text('Categoria', colX[1]!, y, { width: 90 });
      doc.text('Telefone', colX[2]!, y, { width: 55 });
      doc.text('Score IA', colX[3]!, y, { width: 50 });
      doc.text('Site/IG', colX[4]!, y, { width: 50 });
      doc.fillColor('#000000').font('Helvetica').fontSize(7);
    };

    let y = doc.y;
    drawTableHeader(y);
    y += 18;

    for (const c of companies) {
      if (y > 750) {
        doc.addPage();
        y = 50;
        drawTableHeader(y);
        y += 18;
      }

      const name = (c.name || 'Sem nome').substring(0, 28);
      const category = (c.category || '').substring(0, 15);
      const phone = (c.phone || '').substring(0, 15);
      const score = c.enrichedData?.qualityScore != null ? String(c.enrichedData.qualityScore) : '-';
      const hasSite = c.hasWebsite ? 'S' : 'N';
      const hasIG = c.hasInstagram ? 'S' : 'N';

      doc.fontSize(8).font('Helvetica-Bold').text(name, colX[0]!, y, { width: 160 });
      doc.fontSize(7).font('Helvetica').text(category, colX[1]!, y, { width: 90 });
      doc.text(phone, colX[2]!, y, { width: 55 });
      doc.text(score, colX[3]!, y, { width: 50 });
      doc.text(`Site:${hasSite} IG:${hasIG}`, colX[4]!, y, { width: 55 });

      y += 14;
    }

    doc.end();

    return new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
    });
  }
}
