import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../database/prisma.service';
import { CreateExportDto } from './dto/export.dto';
import { ExportFormat } from '@prisma/client';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';
import { EXPORT_MAX_ROWS } from '../../common/constants';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('exports') private readonly exportQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateExportDto) {
    const fileName = `export-${userId}-${Date.now()}`;
    const format = dto.format || ExportFormat.CSV;

    const exportRecord = await this.prisma.dataExport.create({
      data: {
        userId,
        searchId: dto.searchId,
        format,
        fileName,
        filters: dto.filters || {},
        status: 'processing',
      },
    });

    await this.exportQueue.add('process-export', { exportId: exportRecord.id, userId });

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

    const companies = await this.prisma.company.findMany({
      where,
      take: EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      include: { enrichedData: true },
    });

    const exportDir = path.join(process.cwd(), 'uploads', 'exports');
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
    const filePath = path.join(process.cwd(), 'uploads', 'exports', `${record.fileName}.${ext}`);

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
}
