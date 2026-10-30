import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalTrimmedString,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

/** GET /stock/batch-detail/models */
export class BatchDetailModelsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiPropertyOptional({
    description: 'Typed so far; matched anywhere in the model, ignoring case.',
  })
  @OptionalTrimmedString(100)
  q?: string;
}

/** POST /stock/batch-detail/update — a posted batch's size / colour / model put right. */
export class UpdateBatchDetailDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: 'CBE26-00001', description: 'Matched trimmed and upper-cased.' })
  @TrimmedString(100)
  @IsNotEmpty()
  batchNo!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Omitted: kept. null: cleared.',
  })
  @NullableUuid()
  sizeId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Omitted: kept. null: cleared.',
  })
  @NullableUuid()
  colourId?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'Omitted: kept. null or blank: cleared.',
  })
  @NullableStringStrict(100)
  model?: string | null;

  @ApiProperty({ maxLength: 250, description: 'Why — kept on the audit row.' })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}
