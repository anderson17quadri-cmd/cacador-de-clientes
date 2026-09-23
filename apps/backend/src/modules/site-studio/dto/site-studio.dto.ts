import { IsArray, IsBoolean, IsHexColor, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSiteProjectDto {
  @IsUUID() companyId!: string;
  @IsIn(['contacts', 'bookings', 'quotes', 'services']) objective!: string;
  @IsIn(['local', 'restaurant', 'professional']) template!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) services?: string[];
  @IsOptional() @IsString() @MaxLength(2000) extraInfo?: string;
  @IsOptional() @IsHexColor() primaryColor?: string;
}

export class UpdateSiteProjectDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(['contacts', 'bookings', 'quotes', 'services']) objective?: string;
  @IsOptional() @IsIn(['local', 'restaurant', 'professional']) template?: string;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() accentColor?: string;
  @IsOptional() @IsBoolean() demoBadge?: boolean;
}

export class UpdateAiConfigDto {
  @IsIn(['openai', 'deepseek']) provider!: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(1000) apiKey?: string;
}
