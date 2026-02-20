import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GodownErrorFieldDto {
  @ApiProperty({ example: 'gdl_name' })
  field!: string;

  @ApiProperty({ example: 'gdl_name is required' })
  message!: string;
}

export class GodownErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: GodownErrorFieldDto, isArray: true })
  errors!: GodownErrorFieldDto[];
}

export class GodownPayloadDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  gdl_id!: string;

  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd07' })
  gdl_godown_id!: string;

  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd08' })
  gdl_branch_id!: string;

  @ApiProperty({ example: 'Rack A1' })
  gdl_name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'A1' })
  gdl_short!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'RACK-A1' })
  gdl_code!: string | null;

  @ApiProperty({ example: 'BIN' })
  gdl_type!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  gdl_parent_id!: string | null;

  @ApiProperty({ example: 1 })
  gdl_sort!: number;

  @ApiProperty({ example: 0 })
  gdl_level!: number;

  @ApiProperty({ type: [String], example: [] })
  gdl_path_ids_cache!: string[];

  @ApiProperty({ example: false })
  gdl_del_sheet!: boolean;

  @ApiProperty({ example: false })
  gdl_split_stock!: boolean;

  @ApiProperty({ example: false })
  gdl_negative_stock!: boolean;

  @ApiProperty({ example: 0 })
  gdl_volume!: number;

  @ApiProperty({ example: true })
  gdl_is_active!: boolean;

  @ApiProperty({ example: false })
  gdl_is_deleted!: boolean;

  @ApiProperty({ example: '2026-02-20T10:15:30.000Z' })
  gdl_created_on!: string;

  @ApiPropertyOptional({ nullable: true, example: 'system' })
  gdl_created_by!: string | null;

  @ApiProperty({ example: '2026-02-20T10:15:30.000Z' })
  gdl_modified_on!: string;

  @ApiPropertyOptional({ nullable: true, example: 'system' })
  gdl_modified_by!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Ground floor zone' })
  gdl_remarks!: string | null;
}

export class GodownListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class GodownDeleteResultDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  gdl_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class GodownSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Godown location fetched successfully' })
  message!: string;

  @ApiProperty({ type: GodownPayloadDto })
  data!: GodownPayloadDto;
}

export class GodownSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Godown locations fetched successfully' })
  message!: string;

  @ApiProperty({ type: GodownPayloadDto, isArray: true })
  data!: GodownPayloadDto[];

  @ApiProperty({ type: GodownListMetaDto })
  meta!: GodownListMetaDto;
}

export class GodownSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Godown location deleted successfully' })
  message!: string;

  @ApiProperty({ type: GodownDeleteResultDto })
  data!: GodownDeleteResultDto;
}
