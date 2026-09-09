import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CampaignPreviewDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['email', 'whatsapp'], { each: true })
  channels!: Array<'email' | 'whatsapp'>;

  @IsOptional() @IsString() searchId?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) maxRecipients?: number;
  @IsOptional() @IsArray() @ArrayNotEmpty() @ArrayMaxSize(10000) @IsUUID('4', { each: true }) companyIds?: string[];
}

export class CreateCampaignDto extends CampaignPreviewDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsString() @MinLength(3) @MaxLength(5000) message!: string;
  @IsOptional() @IsString() @MaxLength(120) whatsappTemplate?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsappLanguage?: string;
  @IsInt() @Min(5) @Max(3600) intervalSeconds!: number;
  @IsBoolean() dryRun!: boolean;
  @IsBoolean() consentConfirmed!: boolean;
  @IsOptional() @IsObject() personalizedMessages?: Record<string, string>;
}

export class UpdateCampaignConfigDto {
  @IsOptional() @IsString() @MaxLength(255) smtpHost?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) smtpPort?: number;
  @IsOptional() @IsBoolean() smtpSecure?: boolean;
  @IsOptional() @IsString() @MaxLength(255) smtpUser?: string;
  @IsOptional() @IsString() @MaxLength(500) smtpPass?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== '') @IsEmail() smtpFromEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) smtpFromName?: string;
  @IsOptional() @IsString() @MaxLength(120) whatsappPhoneNumberId?: string;
  @IsOptional() @IsString() @MaxLength(1000) whatsappToken?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsappApiVersion?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) maxDailyMessages?: number;
}

export class TestCampaignConfigDto {
  @IsIn(['email', 'whatsapp'])
  channel!: 'email' | 'whatsapp';
}
