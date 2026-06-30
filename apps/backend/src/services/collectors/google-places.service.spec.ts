import { Test, TestingModule } from '@nestjs/testing';
import { GooglePlacesService } from './google-places.service';
import { ConfigService } from '@nestjs/config';

describe('GooglePlacesService', () => {
  let service: GooglePlacesService;

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'google.placesApiKey') return '';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GooglePlacesService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<GooglePlacesService>(GooglePlacesService);
  });

  describe('mapCategoryToType', () => {
    it('should map "barbearia" to hair_care and beauty_salon', () => {
      const result = (service as any).mapCategoryToType('barbearia');
      expect(result).toContain('hair_care');
      expect(result).toContain('beauty_salon');
    });

    it('should map "restaurante" to restaurant and food', () => {
      const result = (service as any).mapCategoryToType('restaurante');
      expect(result).toContain('restaurant');
      expect(result).toContain('food');
    });

    it('should map "dentista" to dentist', () => {
      const result = (service as any).mapCategoryToType('dentista');
      expect(result).toContain('dentist');
    });

    it('should map "academia" to gym', () => {
      const result = (service as any).mapCategoryToType('academia');
      expect(result).toContain('gym');
    });

    it('should map unknown category to establishment', () => {
      const result = (service as any).mapCategoryToType('categoria_inexistente');
      expect(result).toEqual(['establishment']);
    });

    it('should be case insensitive', () => {
      const result = (service as any).mapCategoryToType('BARBEARIA');
      expect(result).toContain('hair_care');
    });
  });

  describe('mapPlaceToCompany', () => {
    it('should map Google Place fields to company object', () => {
      const place = {
        name: 'Barbearia Teste',
        place_id: 'ChIJ1234567890',
        formatted_address: 'Rua Teste, 123 - Centro, São Paulo - SP, Brasil',
        geometry: { location: { lat: -23.5505, lng: -46.6333 } },
        rating: 4.5,
        user_ratings_total: 100,
        types: ['hair_care', 'beauty_salon'],
        business_status: 'OPERATIONAL',
        photos: [{ photo_reference: 'photo-ref-123' }],
        opening_hours: { open_now: true },
      };

      const result = (service as any).mapPlaceToCompany(place, 'barbearia');

      expect(result.name).toBe('Barbearia Teste');
      expect(result.category).toBe('barbearia');
      expect(result.latitude).toBe(-23.5505);
      expect(result.longitude).toBe(-46.6333);
      expect(result.rating).toBe(4.5);
      expect(result.totalRatings).toBe(100);
      expect(result.source).toBe('google_places');
      expect(result.sourceId).toBe('ChIJ1234567890');
      expect(result.isOpen).toBe(true);
      expect(result.googleMapsLink).toContain('place_id:ChIJ1234567890');
    });

    it('should handle place with minimal data', () => {
      const place = {
        name: 'Loja Minima',
        place_id: 'minimal-id',
        vicinity: 'Centro',
      };

      const result = (service as any).mapPlaceToCompany(place, 'loja');

      expect(result.name).toBe('Loja Minima');
      expect(result.source).toBe('google_places');
      expect(result.sourceId).toBe('minimal-id');
      expect(result.rating).toBeNull();
      expect(result.isOpen).toBeNull();
    });

    it('should handle place without name', () => {
      const place = {
        place_id: 'no-name-id',
      };

      const result = (service as any).mapPlaceToCompany(place, 'teste');

      expect(result.name).toBe('Sem nome');
    });
  });
});
