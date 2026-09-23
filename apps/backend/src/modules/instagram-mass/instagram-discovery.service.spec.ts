import { InstagramDiscoveryService } from './instagram-discovery.service';

describe('InstagramDiscoveryService', () => {
  const service = new InstagramDiscoveryService();

  it('selects a matching company profile from encoded search results', () => {
    const html = '<div class="result"><a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.instagram.com%2Flisboetabarbearia%2F">Barbearia Lisboeta em Lisboa</a></div>';
    const result = (service as any).bestCandidate(html, { name: 'Barbearia Lisboeta', city: 'Lisboa' });
    expect(result).toBe('https://instagram.com/lisboetabarbearia');
  });

  it('rejects an unrelated profile', () => {
    const html = '<div class="result"><a class="result__a" href="https://instagram.com/outra_empresa">Resultado sem relação</a></div>';
    const result = (service as any).bestCandidate(html, { name: 'Barbearia Lisboeta', city: 'Lisboa' });
    expect(result).toBeNull();
  });
});
