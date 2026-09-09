import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  IsOptional,
  Min,
  MinLength,
  Max,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  searchNotifications?: boolean;

  @ApiPropertyOptional({ minimum: 100, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100000)
  defaultRadius?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultCountry?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsString()
  currentPassword!: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
