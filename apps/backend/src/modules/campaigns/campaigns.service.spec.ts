import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  let dataDir: string;
  let service: CampaignsService;
  const prisma = {
    company: {
      findMany: jest.fn(),
    },
  };
  const prospecting = {
    canContact: jest.fn(), dailyOutboundCount: jest.fn(), recordCampaignEvent: jest.fn(),
  };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'leadhunter-campaigns-'));
    process.env.LEADHUNTER_DATA_DIR = dataDir;
    process.env.APP_ENCRYPTION_KEY = 'test-key';
    prisma.company.findMany.mockReset();
    prospecting.canContact.mockImplementation(async (_userId: string, ids: string[]) => new Set(ids));
    prospecting.dailyOutboundCount.mockResolvedValue(0);
    prospecting.recordCampaignEvent.mockResolvedValue(undefined);
    service = new CampaignsService(prisma as any, prospecting as any);
  });

  afterEach(async () => { await rm(dataDir, { recursive: true, force: true }); });

  it('counts deliveries separately for each selected channel', async () => {
    prisma.company.findMany.mockResolvedValue([
      { email: 'a@example.com', whatsapp: '351910000000', phone: null },
      { email: null, whatsapp: null, phone: '351920000000' },
    ]);
    await expect(service.preview('user-1', { channels: ['email', 'whatsapp'] }))
      .resolves.toEqual({ leads: 2, email: 1, whatsapp: 2, deliveries: 3 });
  });

  it('limits a preview to the explicitly selected lead ids', async () => {
    prisma.company.findMany.mockResolvedValue([{ email: null, whatsapp: '351910000000', phone: null }]);
    await service.preview('user-1', {
      channels: ['whatsapp'],
      companyIds: ['c277096d-b229-4b2c-bce5-332c320f7c62'],
    });
    expect(prisma.company.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        search: { userId: 'user-1' },
        id: { in: ['c277096d-b229-4b2c-bce5-332c320f7c62'] },
      }),
    }));
  });

  it('refuses a real campaign without recipient authorization', async () => {
    await expect(service.create('user-1', {
      name: 'Teste', channels: ['email'], subject: 'Olá', message: 'Mensagem',
      intervalSeconds: 30, dryRun: false, consentConfirmed: false,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a safe simulation as a draft', async () => {
    prisma.company.findMany.mockResolvedValue([{ id: 'lead-1', email: 'a@example.com', whatsapp: null, phone: null }]);
    const campaign = await service.create('user-1', {
      name: 'Teste', channels: ['email'], subject: 'Olá {empresa}', message: 'Mensagem',
      intervalSeconds: 30, dryRun: true, consentConfirmed: true,
    });
    expect(campaign).toMatchObject({ status: 'DRAFT', dryRun: true, totalRecipients: 1, totalDeliveries: 1 });
    await expect(service.list('user-1')).resolves.toHaveLength(1);
  });

  it('encrypts channel credentials on disk and never returns the secrets', async () => {
    const result = await service.updateConfig('user-1', {
      smtpHost: 'smtp.example.com', smtpUser: 'sender@example.com', smtpPass: 'secret-password',
      smtpFromEmail: 'sender@example.com', whatsappPhoneNumberId: '123', whatsappToken: 'secret-token',
    });
    expect(result).toMatchObject({ emailReady: true, whatsappReady: true, smtpPassConfigured: true, whatsappTokenConfigured: true });
    expect(result).not.toHaveProperty('smtpPass');
    expect(result).not.toHaveProperty('whatsappToken');
    const stored = await readFile(join(dataDir, 'channels-user-1.enc'), 'utf8');
    expect(stored).not.toContain('secret-password');
    expect(stored).not.toContain('secret-token');
  });
});
