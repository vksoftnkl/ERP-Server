import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalIntegerArray,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  UpperString,
} from '../../dto/dtoDecorators';

export class SaveSupplierDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing supplier',
  })
  @OptionalUuid()
  supId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supBranchId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  supGroupId!: string;

  @ApiProperty({ maxLength: 20 })
  @TrimmedString(20)
  @IsNotEmpty()
  supPurchaseType!: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  supName!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  supShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supCity?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supDistrict?: string | null;

  @ApiProperty({ maxLength: 100 })
  @TrimmedString(100)
  @IsNotEmpty()
  supStateName!: string;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  supCountry?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  supPincode?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  supTel?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  supPhone?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  supMailId?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  supWhatsappNo?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  supWebsiteAddress?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  supChequePreName?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supNotes?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @NullableInteger(0)
  supCreditDays?: number;

  @ApiPropertyOptional({ default: 0 })
  @NullableNumber()
  supCashDiscPerc?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Collection days as integer array (JSON array or comma-separated values)',
  })
  @OptionalIntegerArray()
  supCollectionDays?: number[];

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableString(15)
  supGstNo?: string | null;

  @ApiProperty({ minLength: 2, maxLength: 2 })
  @UpperString(2)
  supStateCode!: string;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  supPanNo?: string | null;

  @ApiProperty({ maxLength: 30 })
  @TrimmedString(30)
  @IsNotEmpty()
  supGstType!: string;

  @ApiPropertyOptional({ maxLength: 25, nullable: true })
  @NullableString(25)
  supSupCst?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supDrugLiscenceNo?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  supRegionName?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionCity?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  supRegionDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supRegionStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  supRegionCountry?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  supBilledDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  supSortOrder?: number | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  supIsActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supStateId?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  supModifiedBy?: string | null;
}
