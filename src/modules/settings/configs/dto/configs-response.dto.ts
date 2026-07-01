import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfigsErrorFieldDto {
  @ApiProperty({ example: 'configName' })
  field!: string;

  @ApiProperty({ example: 'configName must not be empty' })
  message!: string;
}

export class ConfigsErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ConfigsErrorFieldDto, isArray: true })
  errors!: ConfigsErrorFieldDto[];
}

export class ConfigsPayloadDto {
  @ApiProperty({ example: 1 })
  configId!: number;

  @ApiPropertyOptional({ nullable: true })
  configName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  configValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  configSyncDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  configCreatedOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  configCreatedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  configModifiedOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  configModifiedBy!: string | null;
}

export class ConfigsDeleteResultDto {
  @ApiProperty({ example: 1 })
  configId!: number;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ConfigsSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Config fetched successfully' })
  message!: string;

  @ApiProperty({ type: ConfigsPayloadDto })
  data!: ConfigsPayloadDto;
}

export class ConfigsSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Configs fetched successfully' })
  message!: string;

  @ApiProperty({ type: ConfigsPayloadDto, isArray: true })
  data!: ConfigsPayloadDto[];
}

export class ConfigsSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Config deleted successfully' })
  message!: string;

  @ApiProperty({ type: ConfigsDeleteResultDto })
  data!: ConfigsDeleteResultDto;
}
