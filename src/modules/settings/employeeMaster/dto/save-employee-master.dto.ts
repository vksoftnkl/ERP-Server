import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableEmail,
  NullableString,
  NullableUuid,
  OptionalBoolean,
} from '../../dto/dtoDecorators';

const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toNullableNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export class SaveEmployeeMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing employee',
  })
  @IsOptional()
  @IsUUID('all')
  empId?: string;

  @ApiProperty({ format: 'uuid' })
  @NullableUuid()
  empCompanyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empBranchId?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @NullableString(60)
  empCode?: string | null;

  @ApiProperty({ maxLength: 200 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  empName!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  empAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empMobile1?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empMobile2?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableEmail(150)
  empEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  empAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  empAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  empAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  empCity?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  empDistrict?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  empState?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  empPincode?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  empGender?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empMaritalStatus?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  empBloodGroup?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  empDob?: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empDepartmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empDesignationId?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empEmploymentType?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empStatus?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  empJoinedOn?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  empProbationEndOn?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  empConfirmationOn?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDate()
  empLeftOn?: Date | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empShiftId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empAttConstraintId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empHolidayGroupId?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  empOvertimeAllowed?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  empHasCommission?: boolean;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empCommissionType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  empCommissionValue?: number | null;

  @ApiProperty({ maxLength: 10 })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  empSalaryType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  empSalaryAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  empBataAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  empKmBataAmount?: number;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empPanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empAadharNo?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  empPfNo?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  empEsiNo?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empLoanLedgerId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  empPhotoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Base64-encoded image bytes' })
  @NullableString()
  empPhoto?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  empRemarks?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  empIsActive?: boolean;
}
