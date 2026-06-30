import { Test, TestingModule } from '@nestjs/testing';
import { ExportsService } from './exports.service';
import { PrismaService } from '../../database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('ExportsService', () => {
  let service: ExportsService;

  const mockPrisma = {
    dataExport: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('exports'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<ExportsService>(ExportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCSV', () => {
    it('should generate CSV with header and one row per company', () => {
      const companies = [
        {
          name: 'Teste A',
          category: 'Barbearia',
          phone: '+5511999999999',
          whatsapp: null,
          email: 'teste@teste.com',
          website: 'https://teste.com',
          instagram: 'teste',
          facebook: null,
          linkedin: null,
          tiktok: null,
          youtube: null,
          address: 'Rua A, 123',
          city: 'Sao Paulo',
          state: 'SP',
          postalCode: '01000-000',
          country: 'Brasil',
          latitude: -23.5,
          longitude: -46.6,
          rating: 4.5,
          totalRatings: 100,
          enrichedData: { qualityScore: 85, presenceLevel: 'HIGH' },
          hasWebsite: true,
          hasInstagram: true,
          hasWhatsapp: false,
          hasEmail: true,
        },
        {
          name: 'Teste B',
          category: 'Padaria',
          phone: null,
          whatsapp: null,
          email: null,
          website: null,
          instagram: null,
          facebook: null,
          linkedin: null,
          tiktok: null,
          youtube: null,
          address: 'Rua B, 456',
          city: 'Rio de Janeiro',
          state: 'RJ',
          postalCode: '20000-000',
          country: 'Brasil',
          latitude: -22.9,
          longitude: -43.2,
          rating: 3.0,
          totalRatings: 20,
          enrichedData: null,
          hasWebsite: false,
          hasInstagram: false,
          hasWhatsapp: false,
          hasEmail: false,
        },
      ];

      const csv = (service as any).generateCSV(companies);

      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);

      const lines = csv.split('\n');
      expect(lines.length).toBe(3); // header + 2 rows
      expect(lines[0]).toContain('Nome');
      expect(lines[0]).toContain('Categoria');
      expect(lines[0]).toContain('Score IA');
      expect(lines[1]).toContain('Teste A');
      expect(lines[1]).toContain('Barbearia');
      expect(lines[2]).toContain('Teste B');
      expect(lines[2]).toContain('Padaria');
    });

    it('should escape values with commas and quotes', () => {
      const companies = [
        {
          name: 'Empresa, Comma',
          category: 'Loja',
          phone: null,
          whatsapp: null,
          email: null,
          website: null,
          instagram: null,
          facebook: null,
          linkedin: null,
          tiktok: null,
          youtube: null,
          address: null,
          city: null,
          state: null,
          postalCode: null,
          country: null,
          latitude: null,
          longitude: null,
          rating: null,
          totalRatings: null,
          enrichedData: null,
          hasWebsite: false,
          hasInstagram: false,
          hasWhatsapp: false,
          hasEmail: false,
        },
      ];

      const csv = (service as any).generateCSV(companies);

      expect(csv).toContain('"Empresa, Comma"');
    });
  });

  describe('create', () => {
    it('should create export record and enqueue job', async () => {
      mockPrisma.dataExport.create.mockResolvedValue({
        id: 'export-1',
        userId: 'user-1',
        searchId: null,
        format: 'CSV',
        fileName: 'export-user-1-123',
        filters: {},
        status: 'processing',
      });

      const result = await service.create('user-1', { format: 'CSV' as any });

      expect(mockPrisma.dataExport.create).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith('process-export', {
        exportId: 'export-1',
        userId: 'user-1',
      });
      expect(result.format).toBe('CSV');
      expect(result.status).toBe('processing');
    });
  });

  describe('findAll', () => {
    it('should return paginated exports for user', async () => {
      mockPrisma.dataExport.count.mockResolvedValue(2);
      mockPrisma.dataExport.findMany.mockResolvedValue([
        { id: '1', userId: 'user-1', format: 'CSV' },
        { id: '2', userId: 'user-1', format: 'JSON' },
      ]);

      const result = await service.findAll('user-1', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
