import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyGroupMasterErrorFieldDto {
  @ApiProperty({ example: 'cogGroupName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate cogGroupName is not allowed' })
  message!: string;
}

export class CompanyGroupMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: CompanyGroupMasterErrorFieldDto, isArray: true })
  errors!: CompanyGroupMasterErrorFieldDto[];
}

export class CompanyGroupMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  cogGroupId!: string;

  @ApiProperty()
  cogGroupName!: string;

  @ApiProperty({ type: [String] })
  cogCompanyIds!: string[];

  @ApiProperty()
  cogIsActive!: boolean;

  @ApiProperty()
  cogIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  cogSyncDate!: string | null;

  @ApiProperty()
  cogCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  cogCreatedBy!: string | null;

  @ApiProperty()
  cogModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  cogModifiedBy!: string | null;
}

export class CompanyGroupMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class CompanyGroupMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  cogGroupId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class CompanyGroupMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Company group fetched successfully' })
  message!: string;

  @ApiProperty({ type: CompanyGroupMasterPayloadDto })
  data!: CompanyGroupMasterPayloadDto;
}

export class CompanyGroupMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Company groups fetched successfully' })
  message!: string;

  @ApiProperty({ type: CompanyGroupMasterPayloadDto, isArray: true })
  data!: CompanyGroupMasterPayloadDto[];

  @ApiProperty({ type: CompanyGroupMasterListMetaDto })
  meta!: CompanyGroupMasterListMetaDto;
}

export class CompanyGroupMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Company group deleted successfully' })
  message!: string;

  @ApiProperty({ type: CompanyGroupMasterDeleteResultDto })
  data!: CompanyGroupMasterDeleteResultDto;
}
