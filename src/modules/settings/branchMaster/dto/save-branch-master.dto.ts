import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  NullableDate,
  NullableEmail,
  NullableNumber,
  NullableString,
  NullableUpperMaxString,
  NullableUpperString,
  NullableUuid,
  OptionalBoolean,
  UpperString,
} from 'src/common/dto/dtoDecorators';
import { GST_REG_TYPES } from '../../shared/gst-registration';

/** Notes 72 C4: stored, and drives nothing yet. */
const INFORMATIONAL =
  'Informational: stored and returned, but no posting, numbering, rounding or print reads it yet.';

export class SaveBranchMasterDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'When provided, request updates the existing branch',
  })
  @IsOptional()
  @IsUUID('all')
  brId?: string;
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'On update a branch cannot change company once it has documents, stock, users or ' +
      'devices, nor while it is its company’s default branch (400, notes 72 B4).',
  })
  @IsUUID('all')
  brCompId!: string;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  brCode?: string | null;
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  brName!: string;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  brMailingName?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  brAlias?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  brShort?: string | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  brType?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  brIsDefault?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  brIsActive?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brAddr1?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brAddr2?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brAddr3?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  brCity?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  brDistrict?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  brState?: string | null;
  @ApiProperty({ maxLength: 2 })
  @UpperString(2)
  brStateCode!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brPin?: number;
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  brCountry?: string;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  brLandmark?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brRegionAddr1?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brRegionAddr2?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brRegionAddr3?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  brRegionCity?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  brRegionDistrict?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brRegionState?: string | null;
  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  brRegionCountry?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  brRegionName?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  brContactPerson?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  brTel?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  brPhone?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableEmail(150)
  brMail?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: INFORMATIONAL })
  @NullableString(20)
  brBillPrefix?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: INFORMATIONAL })
  @NullableString(20)
  brInvoiceSeriesPrefix?: string | null;
  @ApiPropertyOptional({ maxLength: 300, nullable: true, description: INFORMATIONAL })
  @NullableString(300)
  brBillGreeting?: string | null;
  @ApiPropertyOptional({ nullable: true, description: INFORMATIONAL })
  @NullableString()
  brTerms?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: INFORMATIONAL })
  @NullableString(20)
  brRoundingMode?: string | null;
  @ApiPropertyOptional({ nullable: true, description: INFORMATIONAL })
  @NullableNumber()
  brRoundingValue?: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  brDefaultGodownId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: INFORMATIONAL })
  @NullableString(20)
  brPosType?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  brAllowNegativeStock?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  brSmsApplicable?: boolean;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  brBankId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  brFssaiNo?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  brFssaiLicenseType?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  brFssaiValidUpto?: Date | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableUpperString(15)
  brGstinNo?: string | null;
  @ApiPropertyOptional({
    enum: GST_REG_TYPES,
    nullable: true,
    description: 'Upper-cased on the way in; anything else is a 400 (notes 72 C3).',
  })
  @NullableUpperMaxString(30)
  @IsIn(GST_REG_TYPES)
  brGstRegType?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableUpperString(10)
  brPanNo?: string | null;
}
