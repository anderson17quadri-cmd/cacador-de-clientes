import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString,
  IsUUID, Max, MaxLength, Min,
} from 'class-validator';

export const CRM_STATUSES = [
  'NEW', 'CONTACTED', 'REPLIED', 'MEETING', 'PROPOSAL', 'WON', 'REJECTED',
] as const;

export class UpdateLeadCrmDto {
  @IsOptional() @IsIn(CRM_STATUSES) status?: typeof CRM_STATUSES[number];
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsString() nextFollowUpAt?: string;
  @IsOptional() @IsBoolean() doNotContact?: boolean;
  @IsOptional() @IsString() @MaxLength(500) doNotContactReason?: string;
  @IsOptional() @IsString() @MaxLength(120) consentBasis?: string;
}

export class ValidateContactsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('4', { each: true }) companyIds?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

export class CreateContactEventDto {
  @IsUUID('4') companyId!: string;
  @IsIn(['whatsapp', 'email', 'phone', 'instagram']) channel!: string;
  @IsIn(['inbound', 'outbound']) direction!: string;
  @IsOptional() @IsIn(['queued', 'sent', 'delivered', 'read', 'replied', 'failed', 'simulated']) status?: string;
  @IsString() @MaxLength(5000) content!: string;
}

export class GenerateMessagesDto {
  @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) companyIds!: string[];
  @IsOptional() @IsString() @MaxLength(500) offer?: string;
  @IsOptional() @IsString() @MaxLength(500) tone?: string;
}

export class CreateAutomationDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(100) category!: string;
  @IsString() @MaxLength(100) city!: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1000) @Max(100000) radius?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(720) frequencyHours!: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateAutomationDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1000) @Max(100000) radius?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720) frequencyHours?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
