import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeDesignationMasterErrorFieldDto {
  @ApiProperty({ example: 'edName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate edName is not allowed' })
  message!: string;
}

export class EmployeeDesignationMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: EmployeeDesignationMasterErrorFieldDto, isArray: true })
  errors!: EmployeeDesignationMasterErrorFieldDto[];
}

export class EmployeeDesignationMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  edId!: string;

  @ApiProperty()
  edName!: string;

  @ApiPropertyOptional({ nullable: true })
  edCode!: string | null;

  @ApiProperty()
  edIsDefault!: boolean;

  @ApiPropertyOptional({ nullable: true })
  edRemarks!: string | null;

  @ApiProperty()
  edIsActive!: boolean;

  @ApiProperty()
  edIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  edSyncDate!: string | null;

  @ApiProperty()
  edCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  edCreatedBy!: string | null;

  @ApiProperty()
  edModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  edModifiedBy!: string | null;
}

export class EmployeeDesignationMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class EmployeeDesignationMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  edId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class EmployeeDesignationMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee designation fetched successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeDesignationMasterPayloadDto })
  data!: EmployeeDesignationMasterPayloadDto;
}

export class EmployeeDesignationMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee designations fetched successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeDesignationMasterPayloadDto, isArray: true })
  data!: EmployeeDesignationMasterPayloadDto[];

  @ApiProperty({ type: EmployeeDesignationMasterListMetaDto })
  meta!: EmployeeDesignationMasterListMetaDto;
}

export class EmployeeDesignationMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee designation deleted successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeDesignationMasterDeleteResultDto })
  data!: EmployeeDesignationMasterDeleteResultDto;
}
