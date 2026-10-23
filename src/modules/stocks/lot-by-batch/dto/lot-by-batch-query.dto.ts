import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { OptionalQueryBoolean, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';

export class LotByBatchQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'The branch whose stock is counted.' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    example: 'CBE26-00001',
    description: 'What the scanner read. Matched as the lot key folds it: trimmed, upper-cased.',
  })
  @TrimmedString(100)
  @IsNotEmpty()
  batchNo!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'true: also the lots with no saleable stock at this branch.',
  })
  @OptionalQueryBoolean()
  includeEmpty?: boolean;
}
