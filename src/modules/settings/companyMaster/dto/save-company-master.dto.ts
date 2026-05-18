import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableEmail,
  NullableString,
  NullableUpperString,
  NullableUuid,
  OptionalBoolean,
  OptionalUpperString,
  UpperString,
} from 'src/common/dto/dtoDecorators';
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
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  compGstRegType?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableUpperString(10)
  compPanNo?: string | null;
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

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  compFinYearFrom?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  compFinYearTo?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  compBooksBeginFrom?: Date | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compGstApplicable?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  compTcsApplicable?: boolean;

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

  @ApiProperty({ type: String, format: 'color', nullable: true })
  @Type(() => String)
  @IsString()
  compStylesheetId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  compBankId?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  compPriceFixing?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  compPrefixCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
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
}
