import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GspProviderMasterErrorFieldDto {
  @ApiProperty({ example: 'gspProviderName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate gspProviderName is not allowed' })
  message!: string;
}

export class GspProviderMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: GspProviderMasterErrorFieldDto, isArray: true })
  errors!: GspProviderMasterErrorFieldDto[];
}

export class GspProviderMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  gspProviderId!: string;

  @ApiProperty()
  gspProviderCode!: string;

  @ApiProperty()
  gspProviderName!: string;

  @ApiProperty()
  gspBaseUrl!: string;

  @ApiProperty()
  gspRoute!: string;

  @ApiProperty()
  gspIpAddress!: string;

  @ApiProperty()
  gspUserName!: string;

  @ApiProperty()
  gspUserPassword!: string;

  @ApiProperty()
  gspIsActive!: boolean;

  @ApiProperty()
  gspIsDeleted!: boolean;

  @ApiProperty()
  gspCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  gspCreatedBy!: string | null;

  @ApiProperty()
  gspModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  gspModifiedBy!: string | null;
}

export class GspProviderMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class GspProviderMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  gspProviderId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class GspProviderMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'GSP provider fetched successfully' })
  message!: string;

  @ApiProperty({ type: GspProviderMasterPayloadDto })
  data!: GspProviderMasterPayloadDto;
}

export class GspProviderMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'GSP providers fetched successfully' })
  message!: string;

  @ApiProperty({ type: GspProviderMasterPayloadDto, isArray: true })
  data!: GspProviderMasterPayloadDto[];

  @ApiProperty({ type: GspProviderMasterListMetaDto })
  meta!: GspProviderMasterListMetaDto;
}

export class GspProviderMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'GSP provider deleted successfully' })
  message!: string;

  @ApiProperty({ type: GspProviderMasterDeleteResultDto })
  data!: GspProviderMasterDeleteResultDto;
}
