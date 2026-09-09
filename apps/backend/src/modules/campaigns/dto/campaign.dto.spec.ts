import { validate } from 'class-validator';
import { UpdateCampaignConfigDto } from './campaign.dto';

describe('UpdateCampaignConfigDto', () => {
  it('allows saving integrations while the optional sender email is empty', async () => {
    const dto = Object.assign(new UpdateCampaignConfigDto(), {
      smtpFromEmail: '', smtpPort: 587, smtpSecure: false, maxDailyMessages: 50,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('still rejects a non-empty invalid sender email', async () => {
    const dto = Object.assign(new UpdateCampaignConfigDto(), { smtpFromEmail: 'invalido' });

    expect((await validate(dto)).some((error) => error.property === 'smtpFromEmail')).toBe(true);
  });
});
