import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class GspCompanyServiceErrorFieldDto {
  @ApiProperty({ example: 'csgServiceType' })
  field!: string;
  @ApiProperty({ example: 'Duplicate csgServiceType is not allowed' })
  message!: string;
}
export class GspCompanyServiceErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: GspCompanyServiceErrorFieldDto, isArray: true })
  errors!: GspCompanyServiceErrorFieldDto[];
}
export class GspCompanyServicePayloadDto {
  @ApiProperty({ format: 'uuid' })
  csgCompanyServiceId!: string;
  @ApiProperty({ format: 'uuid' })
  csgCompanyId!: string;
  @ApiPropertyOptional({ nullable: true })
  companyName!: string | null;
  @ApiPropertyOptional({ nullable: true })
  companyDisplay!: string | null;
  @ApiProperty({ format: 'uuid' })
  csgGspProviderId!: string;
  @ApiPropertyOptional({ nullable: true })
  providerName!: string | null;
  @ApiPropertyOptional({ nullable: true })
  providerDisplay!: string | null;
  @ApiProperty()
  csgServiceType!: string;
  @ApiProperty()
  csgEuserName!: string;
  @ApiProperty()
  csgEuserPassword!: string;
  @ApiPropertyOptional({ nullable: true })
  csgAuthToken!: string | null;
  @ApiPropertyOptional({ nullable: true })
  csgAuthTokenValidTill!: string | null;
  @ApiProperty()
  csgIsActive!: boolean;
  @ApiProperty()
  csgIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  csgSyncDate!: string | null;
  @ApiProperty()
  csgCreatedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  csgCreatedBy!: string | null;
  @ApiProperty()
  csgModifiedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  csgModifiedBy!: string | null;
}
export class GspCompanyServiceDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  csgCompanyServiceId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class GspCompanyServiceSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'GSP company service fetched successfully' })
  message!: string;
  @ApiProperty({ type: GspCompanyServicePayloadDto })
  data!: GspCompanyServicePayloadDto;
}
export class GspCompanyServiceSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'GSP company service deleted successfully' })
  message!: string;
  @ApiProperty({ type: GspCompanyServiceDeleteResultDto })
  data!: GspCompanyServiceDeleteResultDto;
}
