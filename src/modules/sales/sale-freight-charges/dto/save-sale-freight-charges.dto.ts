import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableNumber,
  NullableUuid,
  OptionalBoolean,
  NullableString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
export class SaveSaleFreightChargeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing sale freight charge',
  })
  @OptionalUuid()
  frId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  frCompanyId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  frBranchId?: string | null;
  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frFromKm?: number | null;
  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frToKm?: number | null;
  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frFromWeight?: number | null;
  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frToWeight?: number | null;
  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frFreightChrg?: number | null;
  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  frIsActive?: boolean;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  frCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  frModifiedBy?: string | null;
}