import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';

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

export class GspCompanyServiceListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
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

export class GspCompanyServiceSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'GSP company services fetched successfully' })
  message!: string;

  @ApiProperty({ type: GspCompanyServicePayloadDto, isArray: true })
  data!: GspCompanyServicePayloadDto[];

  @ApiProperty({ type: GspCompanyServiceListMetaDto })
  meta!: GspCompanyServiceListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class GspCompanyServiceSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'GSP company service deleted successfully' })
  message!: string;

  @ApiProperty({ type: GspCompanyServiceDeleteResultDto })
  data!: GspCompanyServiceDeleteResultDto;
}
