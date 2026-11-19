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
  Length,
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
} from 'src/common/dto/dtoDecorators';
import { GST_REG_TYPES } from '../../shared/gst-registration';
import { upperStateCode } from '../../shared/registered-address';

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
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description:
      'Blank on CREATE: the server makes one from compName (plan C1) — the initials of its ' +
      'words, skipping PRIVATE, PVT, LIMITED, LTD, THE, AND and &, padded from the first word ' +
      'to 3, at most 6, A-Z 0-9; 2, 3, … added when taken ("MT Demo Traders" → MDT, MDT2). ' +
      'A typed code is kept as typed (409 COMPANY_CODE_DUPLICATE when taken).',
  })
  @NullableString(20)
  compCode?: string | null;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  compName!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  compShort?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Required when compGstRegType is REGULAR, COMPOSITION or SEZ (400 COMPANY_LEGAL_NAME_REQUIRED).',
  })
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
  @ApiProperty({
    maxLength: 2,
    description:
      'Two characters, upper-cased. Blank or null: 400 COMPANY_ADDRESS_REQUIRED (field ' +
      'compStateCode) for a REGULAR / COMPOSITION / SEZ company, else COMPANY_STATE_CODE_INVALID.',
  })
  @Transform(upperStateCode)
  @ValidateIf((dto: SaveCompanyMasterDto) => dto.compStateCode !== '')
  @IsString()
  @Length(2, 2)
  compStateCode!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      '100000 – 999999 when given (400 COMPANY_PIN_INVALID). Required for a REGULAR / ' +
      'COMPOSITION / SEZ company, as are compAddr1, compCity and compStateCode: one ' +
      'COMPANY_ADDRESS_REQUIRED error per missing key, its field the key (plan I1). District is optional.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  compPin?: number | null;

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
      "CREATE ONLY: the first fiscal year's begin date — a 1 April, else 400 (a year is always " +
      '1 April – 31 March). Default: the year containing compBooksBeginFrom, else today. ' +
      "Ignored on update — the year belongs to fiscal_years. GET returns the current year's begin date.",
  })
  @NullableDate()
  compFinYearFrom?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      "CREATE ONLY: the first fiscal year's end date — the 31 March after compFinYearFrom, " +
      "else 400. Ignored on update. GET returns the current year's end date.",
  })
  @NullableDate()
  compFinYearTo?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'CREATE ONLY: when the books begin, inside the first year (default: its 1 April; 400 ' +
      "outside it). Without From/To it picks the year. Ignored on update. GET returns the current year's books-begin date.",
  })
  @NullableDate()
  compBooksBeginFrom?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'Books lock date (companys.comp_books_lock_date), saved and returned as sent; null clears ' +
      'it. Nothing enforces it yet (plan Q1: the next job). It is not the fiscal year’s ' +
      'fy_lock_date, which locks a whole year and is set elsewhere.',
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

  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description: `${INFORMATIONAL} Off the Qt screen since 18/11; optional, kept when not sent.`,
  })
  @NullableString(50)
  compPriceFixing?: string | null;

  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: `${INFORMATIONAL} Off the Qt screen since 18/11; optional, kept when not sent.`,
  })
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

  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    description: 'Blank or absent on CREATE: "Rs." (plan C5). On update it is saved as sent.',
  })
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

  @ApiPropertyOptional({
    maxLength: 19,
    nullable: true,
    example: 'UDYAM-TN-01-0012345',
    description:
      'Udyam (MSME) registration no: trimmed and upper-cased, then UDYAM-XX-00-0000000 ' +
      '(2 letters, 2 digits, 7 digits), else 400 COMPANY_UDYAM_INVALID. null or "" clears it.',
  })
  @NullableUpperMaxString()
  compUdyamNo?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Company logo, the same rules as compAuthorizeSignature: a data URL or bare base64 of a ' +
      'PNG, JPEG, GIF or WebP, at most 512 KB, the kind read from the bytes (400 ' +
      'COMPANY_LOGO_NOT_BASE64 / _TOO_LARGE / _NOT_IMAGE). GET returns a data URL. null or "" clears it.',
  })
  @NullableString()
  compLogo?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    example: 'R. Kumar, Proprietor',
    description: 'Authorised signatory name and designation as printed. Trimmed; "" clears it.',
  })
  @NullableString(100)
  compSignatoryName?: string | null;
}
