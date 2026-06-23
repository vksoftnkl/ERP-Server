import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountGroupNature, AccountGroupType } from '../types/account-group-enum';

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

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  accGroupCompanyId!: string | null;

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

  @ApiPropertyOptional({
    enum: AccountGroupNature,
    enumName: 'AccountGroupNature',
    maxLength: 20,
    nullable: true,
  })
  accGroupNature!: string | null;

  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  accGroupTallyGuid!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Tally master id (BigInt serialized as string)',
  })
  accGroupTallyMasterId!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Tally alter id (BigInt serialized as string)',
  })
  accGroupTallyAlterId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  accGroupParentId!: string | null;

  @ApiPropertyOptional({
    maxLength: 150,
    nullable: true,
    description: 'Name of the parent account group',
  })
  accGroupParentName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  accGroupSort!: number | null;

  @ApiProperty({ type: [String], example: [] })
  accGroupChildIds!: string[];

  @ApiProperty({ enum: AccountGroupType, enumName: 'AccountGroupType', maxLength: 20 })
  accGroupType!: string;

  @ApiProperty()
  accGroupIsDefault!: boolean;

  @ApiProperty()
  accLedgerProfile!: string;


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

export class AccountGroupSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account group deleted successfully' })
  message!: string;

  @ApiProperty({ type: AccountGroupDeleteResultDto })
  data!: AccountGroupDeleteResultDto;
}
