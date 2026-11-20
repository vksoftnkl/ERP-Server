import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableEmail,
  NullableString,
  NullableUuid,
  OptionalBoolean,
} from 'src/common/dto/dtoDecorators';
import { NullableUpperPattern } from 'src/common/party/party-gstin';
import {
  COMMISSION_TYPES,
  EMPLOYEE_COMMISSION_VALUE_PATTERN,
  EMPLOYEE_IFSC_PATTERN,
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_WORKING,
  EMPLOYMENT_TYPES,
  canonicalListValue,
} from '../types/employee-master-values';

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

/**
 * HR review step 5 — emp_commission_value as text, so the service makes a
 * Prisma.Decimal of it with no float in between (money-decimal rule). A JSON
 * number is taken as its own text; blank is null (= cleared).
 */
const toCommissionValueText = (value: unknown): unknown => {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
};

export class SaveEmployeeMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing employee',
  })
  @IsOptional()
  @IsUUID('all')
  empId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Blank (absent or null) on create = the logged-in company (from the token). On an edit, ' +
      'null clears it and absent keeps it.',
  })
  @NullableUuid()
  empCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  empBranchId?: string | null;

  @ApiPropertyOptional({
    maxLength: 60,
    nullable: true,
    description:
      'Blank on create: made from the name (initials, 3 to 6 letters; RAM2 … when taken: ' +
      'Suresh Krishna → SKU). Unique among live employees in any case (409 ' +
      'EMPLOYEE_CODE_DUPLICATE). An edit never makes one; blank clears it.',
  })
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

  @ApiPropertyOptional({
    enum: EMPLOYMENT_TYPES,
    nullable: true,
    description:
      'Any case is stored in this spelling. Blank = not stated (null). Else 400 VALIDATION_IS_IN.',
  })
  @IsOptional()
  @Transform(({ value }) => canonicalListValue(value, EMPLOYMENT_TYPES, null))
  @IsIn([...EMPLOYMENT_TYPES])
  empEmploymentType?: string | null;

  @ApiPropertyOptional({
    enum: EMPLOYEE_STATUSES,
    nullable: true,
    description:
      'Any case is stored as Working / Resigned. Blank (null or "") = Working; absent on create = ' +
      'Working, absent on an edit = unchanged. Else 400 VALIDATION_IS_IN.',
  })
  @IsOptional()
  @Transform(({ value }) => canonicalListValue(value, EMPLOYEE_STATUSES, EMPLOYEE_STATUS_WORKING))
  @IsIn([...EMPLOYEE_STATUSES])
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

  @ApiPropertyOptional({
    enum: COMMISSION_TYPES,
    nullable: true,
    description:
      'Any case is stored in this spelling. Blank = not stated (null). Else 400 VALIDATION_IS_IN.',
  })
  @IsOptional()
  @Transform(({ value }) => canonicalListValue(value, COMMISSION_TYPES, null))
  @IsIn([...COMMISSION_TYPES])
  empCommissionType?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2.5',
    description:
      'numeric(12,3): a decimal string or a number, 0 or more, up to 3 decimals (else 400 ' +
      'VALIDATION_MATCHES). Kept as Prisma.Decimal; blank = null.',
  })
  @IsOptional()
  @Transform(({ value }) => toCommissionValueText(value))
  @IsString()
  @Matches(EMPLOYEE_COMMISSION_VALUE_PATTERN)
  empCommissionValue?: string | null;

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

  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: 'UAN (PF universal account no).',
  })
  @NullableString(20)
  empUanNo?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  empBankName?: string | null;

  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description: 'Shown as the last 4 only in the history (audit) view.',
  })
  @NullableString(50)
  empBankAccountNo?: string | null;

  @ApiPropertyOptional({
    maxLength: 11,
    nullable: true,
    pattern: EMPLOYEE_IFSC_PATTERN.source,
    example: 'SBIN0001234',
    description:
      'Upper-cased, then 4 letters, a 0 and 6 letters or digits (else 400 VALIDATION_IS_IFSC).',
  })
  @NullableUpperPattern(11, 'isIfsc', EMPLOYEE_IFSC_PATTERN, 'an 11-character IFSC (SBIN0001234)')
  empBankIfsc?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  empEmergencyContactName?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  empEmergencyContactPhone?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Staff advance ledger (notes 95). Absent or null: keep the current one, or create ' +
      '"<empName> - Staff Advance" in Loans & Advances (Asset) when there is none. Given: a live ' +
      'ledger in that group or a sub-group, of this company or shared, and no other employee’s.',
  })
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
