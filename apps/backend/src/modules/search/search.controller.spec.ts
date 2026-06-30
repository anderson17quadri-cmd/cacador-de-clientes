import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let app: INestApplication;
  let controller: SearchController;
  let searchService: SearchService;

  const mockSearchService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    getProgress: jest.fn(),
    getLogs: jest.fn(),
    cancel: jest.fn(),
    getResults: jest.fn(),
    streamProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    controller = module.get<SearchController>(SearchController);
    searchService = module.get<SearchService>(SearchService);
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /search', () => {
    it('should call searchService.create with user ID and DTO', async () => {
      const dto = {
        category: 'Barbearia',
        city: 'São Paulo',
        state: 'SP',
        country: 'Brasil',
        radius: 5000,
      };

      mockSearchService.create.mockResolvedValue({ id: 'search-1', ...dto });

      const result = await controller.create('user-1', dto);

      expect(searchService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toHaveProperty('id', 'search-1');
    });

    it('should accept minimal DTO with only category', async () => {
      const dto = { category: 'Restaurante' };

      mockSearchService.create.mockResolvedValue({ id: 'search-2', ...dto });

      const result = await controller.create('user-2', dto);

      expect(searchService.create).toHaveBeenCalledWith('user-2', dto);
      expect(result).toHaveProperty('category', 'Restaurante');
    });
  });

  describe('GET /search', () => {
    it('should return paginated searches', async () => {
      mockSearchService.findAll.mockResolvedValue({
        data: [{ id: '1', category: 'Barbearia' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      });

      const result = await controller.findAll('user-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
    });
  });

  describe('GET /search/:id', () => {
    it('should return search details', async () => {
      mockSearchService.findById.mockResolvedValue({
        id: 'search-1',
        category: 'Barbearia',
        status: 'COMPLETED',
      });

      const result = await controller.findOne('search-1');

      expect(result).toHaveProperty('status', 'COMPLETED');
    });
  });

  describe('POST /search/:id/cancel', () => {
    it('should cancel a running search', async () => {
      mockSearchService.cancel.mockResolvedValue({
        id: 'search-1',
        status: 'CANCELLED',
      });

      const result = await controller.cancel('search-1');

      expect(searchService.cancel).toHaveBeenCalledWith('search-1');
      expect(result).toHaveProperty('status', 'CANCELLED');
    });
  });

  describe('GET /search/:id/results', () => {
    it('should return paginated results', async () => {
      mockSearchService.getResults.mockResolvedValue({
        data: [{ id: 'company-1', name: 'Teste' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      });

      const result = await controller.getResults('search-1', 1, 20);

      expect(result.data).toHaveLength(1);
    });
  });
});
