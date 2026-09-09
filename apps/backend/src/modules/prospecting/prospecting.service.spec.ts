import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProspectingService } from './prospecting.service';

describe('ProspectingService', () => {
  let dataDir: string;
  let service: ProspectingService;
  const company = {
    id: 'lead-1', name: 'Barbearia Lisboa', phone: '+351 912 345 678', whatsapp: null,
    email: null, website: null, instagram: null, city: 'Lisboa', category: 'barbearia',
    hasWebsite: false, hasInstagram: false, createdAt: new Date(), enrichedData: null,
  };
  const prisma = {
    company: {
      findFirst: jest.fn(async () => company),
      findMany: jest.fn(async () => [company]),
      count: jest.fn(async () => 1),
    },
  };
  const searches = { create: jest.fn() };
  const notifications = { create: jest.fn(async () => ({ id: 'notification-1' })) };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'leadhunter-prospecting-'));
    process.env.LEADHUNTER_DATA_DIR = dataDir;
    jest.clearAllMocks();
    service = new ProspectingService(
      prisma as any,
      searches as any,
      notifications as any,
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
    );
  });

  afterEach(async () => {
    delete process.env.LEADHUNTER_DATA_DIR;
    await rm(dataDir, { recursive: true, force: true });
  });

  it('persists CRM state and blocks outbound contact', async () => {
    const state = await service.updateLead('user-1', company.id, {
      status: 'CONTACTED', doNotContact: true, doNotContactReason: 'Pedido do titular',
    });

    expect(state.status).toBe('REJECTED');
    expect(state.doNotContact).toBe(true);
    expect(await service.canContact('user-1', [company.id])).not.toContain(company.id);
    await expect(service.addEvent('user-1', {
      companyId: company.id, channel: 'whatsapp', direction: 'outbound', content: 'Olá',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates Portuguese phone numbers and stores the result', async () => {
    const result = await service.validateContacts('user-1', { companyIds: [company.id], limit: 10 });

    expect(result.total).toBe(1);
    expect(result.results[0]).toMatchObject({
      companyId: company.id, phoneNormalized: '351912345678', phoneStatus: 'VALID_PT',
      whatsappStatus: 'PHONE_ONLY', validity: 'PARTIAL',
    });
    expect(notifications.create).toHaveBeenCalledWith(
      'user-1', 'Validação concluída', '1 contatos verificados.', 'success', expect.any(Object),
    );
  });

  it('generates a personalized local message without inventing a website', async () => {
    const result = await service.generateMessages('user-1', {
      companyIds: [company.id], offer: 'criação de sites', tone: 'cordial',
    });

    expect(result.mode).toBe('local');
    expect(result.messages[0]!.message).toContain('ainda não têm um site próprio');
    expect(result.messages[0]!.message).toContain('REMOVER');
  });

  it('recognizes opt-out replies and exposes analytics', async () => {
    await service.addEvent('user-1', {
      companyId: company.id, channel: 'whatsapp', direction: 'inbound', content: 'Por favor remover',
    });
    const analytics = await service.analytics('user-1');

    expect(analytics.blocked).toBe(1);
    expect(analytics.byStatus.REJECTED).toBe(1);
    expect(analytics.replies).toBe(1);
  });
});
