import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  CONVERTED: 'CONVERTED',
  REJECTED: 'REJECTED',
} as const;

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: Object.values(LeadStatus) })
  @IsString()
  status!: string;
}
