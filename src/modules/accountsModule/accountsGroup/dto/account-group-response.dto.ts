import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountGroupErrorFieldDto {
  @ApiProperty({ example: 'accGroupName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate accGroupName is not allowed for this company' })
  message!: string;
}

export class AccountGroupErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: AccountGroupErrorFieldDto, isArray: true })
  errors!: AccountGroupErrorFieldDto[];
}

export class AccountGroupPayloadDto {
  @ApiProperty({ format: 'uuid' })
  accGroupId!: string;

  @ApiPropertyOptional({ nullable: true })
  accGroupCompanyId!: number | null;

  @ApiProperty({ maxLength: 150 })
  accGroupName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  accGroupAlias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  accGroupShort!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  accGroupDescription!: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  accGroupTallyName!: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  accGroupPrimaryName!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  accGroupNature!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  accGroupParentId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  accGroupSort!: number | null;

  @ApiProperty({ type: [String], example: [] })
  accGroupChildIds!: string[];

  @ApiProperty({ minLength: 2, maxLength: 2 })
  accGroupTypeCode!: string;

  @ApiProperty()
  accGroupIsDefault!: boolean;

  @ApiProperty()
  accGroupBehaveAsSubledger!: boolean;

  @ApiProperty()
  accGroupNetDebitCredit!: boolean;

  @ApiProperty()
  accGroupUsedForCalculation!: boolean;

  @ApiProperty()
  accGroupAffectsGrossProfit!: boolean;

  @ApiProperty()
  accGroupIsActive!: boolean;

  @ApiProperty()
  accGroupIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  accGroupSyncDate!: string | null;

  @ApiProperty()
  accGroupCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  accGroupCreatedBy!: string | null;

  @ApiProperty()
  accGroupModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  accGroupModifiedBy!: string | null;
}

export class AccountGroupListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class AccountGroupDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  accGroupId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class AccountGroupSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account group fetched successfully' })
  message!: string;

  @ApiProperty({ type: AccountGroupPayloadDto })
  data!: AccountGroupPayloadDto;
}

export class AccountGroupSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account groups fetched successfully' })
  message!: string;

  @ApiProperty({ type: AccountGroupPayloadDto, isArray: true })
  data!: AccountGroupPayloadDto[];

  @ApiProperty({ type: AccountGroupListMetaDto })
  meta!: AccountGroupListMetaDto;
}

export class AccountGroupSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account group deleted successfully' })
  message!: string;

  @ApiProperty({ type: AccountGroupDeleteResultDto })
  data!: AccountGroupDeleteResultDto;
}
