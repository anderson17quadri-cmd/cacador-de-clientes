import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const cleanList = ({ value }: { value: unknown }) => Array.isArray(value)
  ? value.map((item) => String(item).trim()).filter(Boolean) : value;

export class CreateInstagramMassDto {
  @IsString() @MaxLength(120) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @Transform(cleanList) @IsString({ each: true }) categories!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @Transform(cleanList) @IsString({ each: true }) cities!: string[];
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsInt() @Min(500) @Max(50000) radius?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsIn(['google_places', 'nominatim', 'overpass', 'foursquare', 'yelp'], { each: true }) sources?: string[];
}

export class InstagramMassResultsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() hasWhatsapp?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() hasWebsite?: boolean;
}
