import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

export class SaveSaleAgentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing sale agent',
  })
  @OptionalUuid()
  saId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  saCompanyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  saBranchId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  saGroupId!: string;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableStringStrict(60)
  saCode?: string | null;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  saName!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  saAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  saMobile1?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  saMobile2?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  saAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  saAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableStringStrict(120)
  saCity?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableStringStrict(120)
  saDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableStringStrict(120)
  saState?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  saPincode?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  saPanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  saGstin?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  saRemarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  saIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  saCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  saModifiedBy?: string | null;
}
