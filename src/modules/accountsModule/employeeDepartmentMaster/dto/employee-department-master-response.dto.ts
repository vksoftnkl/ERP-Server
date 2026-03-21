import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class EmployeeDepartmentMasterErrorFieldDto {
  @ApiProperty({ example: 'edptName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate edptName is not allowed' })
  message!: string;
}

export class EmployeeDepartmentMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: EmployeeDepartmentMasterErrorFieldDto, isArray: true })
  errors!: EmployeeDepartmentMasterErrorFieldDto[];
}

export class EmployeeDepartmentMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  edptId!: string;

  @ApiProperty()
  edptName!: string;

  @ApiPropertyOptional({ nullable: true })
  edptCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  edptAlias!: string | null;

  @ApiPropertyOptional({ nullable: true })
  edptRemarks!: string | null;

  @ApiProperty()
  edptIsActive!: boolean;

  @ApiProperty()
  edptIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  edptSyncDate!: string | null;

  @ApiProperty()
  edptCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  edptCreatedBy!: string | null;

  @ApiProperty()
  edptModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  edptModifiedBy!: string | null;
}

export class EmployeeDepartmentMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class EmployeeDepartmentMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  edptId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class EmployeeDepartmentMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee department fetched successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeDepartmentMasterPayloadDto })
  data!: EmployeeDepartmentMasterPayloadDto;
}

export class EmployeeDepartmentMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee departments fetched successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeDepartmentMasterPayloadDto, isArray: true })
  data!: EmployeeDepartmentMasterPayloadDto[];

  @ApiProperty({ type: EmployeeDepartmentMasterListMetaDto })
  meta!: EmployeeDepartmentMasterListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class EmployeeDepartmentMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Employee department deleted successfully' })
  message!: string;

  @ApiProperty({ type: EmployeeDepartmentMasterDeleteResultDto })
  data!: EmployeeDepartmentMasterDeleteResultDto;
}
