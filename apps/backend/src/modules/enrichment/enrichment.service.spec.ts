import { Test, TestingModule } from '@nestjs/testing';
import { EnrichmentService } from './enrichment.service';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let prisma: PrismaService;

  const mockPrisma = {
    enrichedData: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'openai.apiKey') return null;
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrichmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EnrichmentService>(EnrichmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enrichCompany', () => {
    it('should assign low score and needsMarketing=true for company with no digital presence', async () => {
      mockPrisma.enrichedData.findUnique.mockResolvedValue(null);
      mockPrisma.enrichedData.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'enriched-1', companyId: args.data.companyId, ...args.data }),
      );

      const company = {
        id: 'company-1',
        name: 'Empresa Vazia',
        category: 'Barbearia',
        hasWebsite: false,
        hasInstagram: false,
        hasFacebook: false,
        hasEmail: false,
        hasWhatsapp: false,
        rating: null,
        totalRatings: null,
        phone: null,
        photos: '[]',
        description: null,
        email: null,
        instagram: null,
        website: null,
        whatsapp: null,
        facebook: null,
        linkedin: null,
        tiktok: null,
        youtube: null,
        address: null,
        street: null,
        number: null,
        neighborhood: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        latitude: null,
        longitude: null,
        googleMapsLink: null,
        openingHours: null,
        isOpen: null,
        source: 'test',
        sourceId: null,
        sourceUrl: null,
        rawData: null,
        searchId: 'search-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.enrichCompany(company as any);

      expect(result.qualityScore).toBeLessThanOrEqual(20);
      expect(result.needsMarketing).toBe(true);
      expect(result.needsNewWebsite).toBe(true);
      expect(result.presenceLevel).toBe('VERY_LOW');
      expect(mockPrisma.enrichedData.create).toHaveBeenCalled();
    });

    it('should assign high score for company with full digital presence', async () => {
      mockPrisma.enrichedData.findUnique.mockResolvedValue(null);
      mockPrisma.enrichedData.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'enriched-2', companyId: args.data.companyId, ...args.data }),
      );

      const company = {
        id: 'company-2',
        name: 'Empresa Completa',
        category: 'Restaurante',
        hasWebsite: true,
        hasInstagram: true,
        hasFacebook: true,
        hasEmail: true,
        hasWhatsapp: true,
        rating: 4.5,
        totalRatings: 50,
        phone: '+5511999999999',
        photos: JSON.stringify(['photo1.jpg', 'photo2.jpg']),
        description: null,
        email: 'contato@completa.com',
        instagram: 'completa',
        website: 'https://completa.com',
        whatsapp: '5511999999999',
        facebook: 'completa',
        linkedin: null,
        tiktok: null,
        youtube: null,
        address: null,
        street: null,
        number: null,
        neighborhood: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        latitude: null,
        longitude: null,
        googleMapsLink: null,
        openingHours: null,
        isOpen: null,
        source: 'test',
        sourceId: null,
        sourceUrl: null,
        rawData: null,
        searchId: 'search-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.enrichCompany(company as any);

      expect(result.qualityScore).toBeGreaterThanOrEqual(70);
      expect(result.presenceLevel).toMatch(/HIGH|EXCELLENT/);
      expect(mockPrisma.enrichedData.create).toHaveBeenCalled();
    });

    it('should return existing enrichedData if already present', async () => {
      const existing = {
        id: 'existing-1',
        companyId: 'company-3',
        qualityScore: 50,
        presenceLevel: 'MEDIUM',
        hasVisualIdentity: false,
        hasModernWebsite: false,
        instagramActive: false,
        postsFrequently: false,
        hasFewRatings: true,
        needsMarketing: true,
        needsAutomation: true,
        needsChatbot: true,
        needsNewWebsite: true,
        needsPaidTraffic: true,
        analysisText: 'Teste',
        enrichedAt: new Date(),
      };

      mockPrisma.enrichedData.findUnique.mockResolvedValue(existing);

      const company = {
        id: 'company-3',
        name: 'Qualquer',
        category: 'Loja',
        hasWebsite: false,
        hasInstagram: false,
        hasFacebook: false,
        hasEmail: false,
        hasWhatsapp: false,
        rating: null,
        totalRatings: null,
        phone: null,
        photos: '[]',
        description: null,
        email: null,
        instagram: null,
        website: null,
        whatsapp: null,
        facebook: null,
        linkedin: null,
        tiktok: null,
        youtube: null,
        address: null,
        street: null,
        number: null,
        neighborhood: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        latitude: null,
        longitude: null,
        googleMapsLink: null,
        openingHours: null,
        isOpen: null,
        source: 'test',
        sourceId: null,
        sourceUrl: null,
        rawData: null,
        searchId: 'search-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.enrichCompany(company as any);

      expect(result).toEqual(existing);
      expect(mockPrisma.enrichedData.create).not.toHaveBeenCalled();
    });
  });
});
