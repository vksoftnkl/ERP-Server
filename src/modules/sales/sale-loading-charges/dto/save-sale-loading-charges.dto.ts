import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableNumber,
  NullableUuid,
  OptionalBoolean,
  NullableString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';

export class SaveSaleLoadingChargeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing sale loading charge',
  })
  @OptionalUuid()
  ilcId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ilcCompId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ilcBranchId?: string | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  ilcFromWeight?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  ilcToWeight?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  ilcLoadChrg?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  ilcUnloadChrg?: number | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ilcIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ilcCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ilcModifiedBy?: string | null;
}
