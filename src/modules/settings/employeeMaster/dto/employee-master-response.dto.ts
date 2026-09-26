import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeMasterErrorFieldDto {
  @ApiProperty({ example: 'empName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate empName is not allowed' })
  message!: string;
}

export class EmployeeMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: EmployeeMasterErrorFieldDto, isArray: true })
  errors!: EmployeeMasterErrorFieldDto[];
}

export class EmployeeMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  empId!: string;

  @ApiProperty({ example: 1 })
  empCompanyId!: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Acme Pvt Ltd',
    description: 'Name of the linked company (resolved on the get endpoint)',
  })
  empCompanyName?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  empBranchId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Main Branch',
    description: 'Name of the linked branch (resolved on the get endpoint)',
  })
  empBranchName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  empCode!: string | null;

  @ApiProperty()
  empName!: string;

  @ApiPropertyOptional({ nullable: true })
  empAlias!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empMobile1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empMobile2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empEmail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empAddr1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empAddr2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empAddr3!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empCity!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empDistrict!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empState!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empPincode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empGender!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empMaritalStatus!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empBloodGroup!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empDob!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  empDepartmentId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Accounts',
    description: 'Name of the linked department (resolved on the get endpoint)',
  })
  empDepartmentName?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  empDesignationId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Senior Accountant',
    description: 'Name of the linked designation (resolved on the get endpoint)',
  })
  empDesignationName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  empEmploymentType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empStatus!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empJoinedOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empProbationEndOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empConfirmationOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empLeftOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  empShiftId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  empAttConstraintId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  empHolidayGroupId!: string | null;

  @ApiProperty()
  empOvertimeAllowed!: boolean;

  @ApiProperty()
  empHasCommission!: boolean;

  @ApiPropertyOptional({ nullable: true })
  empCommissionType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empCommissionValue!: number | null;

  @ApiProperty()
  empSalaryType!: string;

  @ApiProperty()
  empSalaryAmount!: number;

  @ApiProperty()
  empBataAmount!: number;

  @ApiProperty()
  empKmBataAmount!: number;

  @ApiPropertyOptional({ nullable: true })
  empPanNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empAadharNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empPfNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empEsiNo!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  empLoanLedgerId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empPhotoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Base64-encoded image bytes' })
  empPhoto!: string | null;

  @ApiPropertyOptional({ nullable: true })
  empRemarks!: string | null;

  @ApiProperty()
  empIsActive!: boolean;

  @ApiProperty()
  empIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  empSyncDate!: string | null;

  @ApiProperty()
  empCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  empCreatedBy!: string | null;

  @ApiProperty()
  empModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  empModifiedBy!: string | null;
}

export class EmployeeMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  empId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class EmployeeMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee fetched successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeMasterPayloadDto })
  data!: EmployeeMasterPayloadDto;
}

export class EmployeeMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee deleted successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeMasterDeleteResultDto })
  data!: EmployeeMasterDeleteResultDto;
}
