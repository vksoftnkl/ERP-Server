import { Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
const toRequiredUuid = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }
  return value.trim();
};
export class OpeningStockIdQueryDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredUuid(value))
  @IsUUID('all')
  avh_voucher_id!: string;
}
