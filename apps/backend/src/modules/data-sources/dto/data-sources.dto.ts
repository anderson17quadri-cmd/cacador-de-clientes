import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const DATA_PROVIDERS = ['nominatim', 'overpass', 'google_places', 'locationiq', 'mapbox', 'opencage'] as const;

export class UpdateDataSourcesDto {
  @IsOptional() @IsString() @MaxLength(1000) googlePlacesKey?: string;
  @IsOptional() @IsString() @MaxLength(1000) locationIqKey?: string;
  @IsOptional() @IsString() @MaxLength(1000) mapboxToken?: string;
  @IsOptional() @IsString() @MaxLength(1000) openCageKey?: string;
  @IsOptional() @IsBoolean() googlePlacesEnabled?: boolean;
  @IsOptional() @IsBoolean() locationIqEnabled?: boolean;
  @IsOptional() @IsBoolean() mapboxEnabled?: boolean;
  @IsOptional() @IsBoolean() openCageEnabled?: boolean;
}

export class TestDataSourceDto {
  @IsIn(DATA_PROVIDERS) provider!: typeof DATA_PROVIDERS[number];
}
