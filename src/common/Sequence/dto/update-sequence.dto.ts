import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CreateSequenceDto } from './create-sequence.dto';
const toNullableUuid = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return value as string;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};
export class UpdateSequenceDto extends PartialType(CreateSequenceDto) {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  modifiedBy?: string | null;
}
