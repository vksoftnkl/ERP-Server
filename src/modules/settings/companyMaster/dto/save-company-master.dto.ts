import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableEmail,
  NullableInteger,
  NullableString,
  NullableUpperMaxString,
  NullableUpperString,
  NullableUuid,
  OptionalBoolean,
  OptionalUpperString,
  UpperString,
} from 'src/common/dto/dtoDecorators';
import { GST_REG_TYPES } from '../../shared/gst-registration';

/** ck_comp_aato_class — the annual aggregate turnover band (notes 72 A2). */
export const COMPANY_AATO_CLASSES = ['LE_1_5CR', 'LE_5CR', 'LE_10CR', 'GT_10CR'] as const;
/** ck on sales.sale_dc.sdc_purpose — what comp_dc_purposes may enable (notes 72 A3). */
export const COMPANY_DC_PURPOSES = [
  'SUPPLY',
  'JOB_WORK',
  'APPROVAL',
  'EXHIBITION',
  'OWN_USE',
  'LINE_SALES',
  'OTHER',
] as const;
/** Notes 72 C4: stored, and drives nothing yet. */
const INFORMATIONAL =
  'Informational: stored and returned, but no posting, numbering or print reads it yet.';
const upperEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : entry))
    : value;

export class SaveCompanyMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the company',
  })
  @NullableUuid()
  compId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  compCode?: string | null;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  compName!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compShort?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compLegalName?: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableUpperString(15)
  compGstinNo?: string | null;
  @ApiPropertyOptional({
    enum: GST_REG_TYPES,
    nullable: true,
    description: 'Upper-cased on the way in; anything else is a 400 (notes 72 C3).',
  })
  @NullableUpperMaxString(30)
  @IsIn(GST_REG_TYPES)
  compGstRegType?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableUpperString(10)
  compPanNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableUpperString()
  compTanNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableUpperString()
  compCinNo?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  compFssaiNo?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  compDrugLicenseNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compAddr1?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compAddr2?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compAddr3?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  compCity?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  compDistrict?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compState?: string | null;
  @ApiProperty({ maxLength: 2 })
  @UpperString(2)
  compStateCode!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  compPin?: number;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  compCountry?: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compRegionAddr1?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compRegionAddr2?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compRegionAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  compRegionCity?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  compRegionDistrict?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compRegionState?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  compRegionCountry?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compRegionName?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  compTel?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  compPhone?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableEmail(150)
  compMail?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableEmail(150)
  compSupportEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  compSupportPhone?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  compWebsiteName?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      "CREATE ONLY: the first fiscal year's begin date (default: the 1 April of the Indian " +
      'financial year containing today). Ignored on update — the year belongs to fiscal_years. ' +
      "GET returns the current fiscal year's begin date.",
  })
  @NullableDate()
  compFinYearFrom?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      "CREATE ONLY: the first fiscal year's end date (default: one year after compFinYearFrom, " +
      "less a day; at most that). Ignored on update. GET returns the current year's end date.",
  })
  @NullableDate()
  compFinYearTo?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'CREATE ONLY: when the books begin, inside the first year (default: its begin date). ' +
      "Ignored on update. GET returns the current year's books-begin date.",
  })
  @NullableDate()
  compBooksBeginFrom?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      "Accepted and IGNORED: the lock date belongs to the fiscal year. GET returns the current year's fy_lock_date.",
  })
  @NullableDate()
  compBooksLockDate?: Date | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compGstApplicable?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compTcsApplicable?: boolean;

  @ApiPropertyOptional({ description: 'Whether the company deducts TDS (notes 72 C1).' })
  @OptionalBoolean()
  compTdsApplicable?: boolean;

  @ApiPropertyOptional({
    enum: COMPANY_AATO_CLASSES,
    description:
      'Annual aggregate turnover band; decides e-invoice applicability and HSN digits. Not nullable.',
  })
  @ValidateIf((dto: SaveCompanyMasterDto) => dto.compAatoClass !== undefined)
  @IsIn(COMPANY_AATO_CLASSES)
  compAatoClass?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: COMPANY_DC_PURPOSES,
    description: 'The delivery-challan purposes this company issues. At least one; not nullable.',
  })
  @ValidateIf((dto: SaveCompanyMasterDto) => dto.compDcPurposes !== undefined)
  @Transform(upperEach)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(COMPANY_DC_PURPOSES, { each: true })
  compDcPurposes?: string[];

  @ApiPropertyOptional()
  @OptionalBoolean()
  compSmsApplicable?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compEinvoiceApplicable?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compEwayApplicable?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  compEwayDate?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  compEwayInterLimit?: number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compEwayIntraApl?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  compEwayIntraLimit?: number;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  compEinvoiceDate?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  compEinvoiceInclEway?: boolean | null;

  @ApiPropertyOptional({ type: Number, format: 'color', nullable: true })
  @NullableInteger()
  compStylesheetId?: number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  compBankId?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true, description: INFORMATIONAL })
  @NullableString(50)
  compPriceFixing?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: INFORMATIONAL })
  @NullableString(20)
  compPrefixCode?: string | null;

  @ApiPropertyOptional({ nullable: true, description: INFORMATIONAL })
  @NullableString()
  compBillGreeting?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compNegStkApl?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compDefault?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 3 })
  @OptionalUpperString(3)
  compCurrencyCode?: string;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  compCurrencySymbol?: string | null;

  @ApiPropertyOptional({ maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  compLocaleCode?: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compRemarks?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Authorised signature image: a data URL (data:image/png;base64,...) or bare base64 of a ' +
      'PNG, JPEG, GIF or WebP, at most 512 KB. GET returns it as a data URL. null or "" clears it.',
  })
  @NullableString()
  compAuthorizeSignature?: string | null;
}
