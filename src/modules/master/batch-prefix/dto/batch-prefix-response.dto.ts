import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchPrefixErrorFieldDto {
  @ApiProperty({ example: 'prefixUsed' })
  field!: string;

  @ApiProperty({ example: 'prefixUsed must not be empty' })
  message!: string;
}

export class BatchPrefixErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: BatchPrefixErrorFieldDto, isArray: true })
  errors!: BatchPrefixErrorFieldDto[];
}

export class BatchPrefixPayloadDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  prefixUsed!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  syncDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdBy!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  createdOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  modifiedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  modifiedOn!: string | null;
}

export class BatchPrefixListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class BatchPrefixDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class BatchPrefixSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Batch prefix fetched successfully' })
  message!: string;

  @ApiProperty({ type: BatchPrefixPayloadDto })
  data!: BatchPrefixPayloadDto;
}

export class BatchPrefixSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Batch prefixes fetched successfully' })
  message!: string;

  @ApiProperty({ type: BatchPrefixPayloadDto, isArray: true })
  data!: BatchPrefixPayloadDto[];

  @ApiProperty({ type: BatchPrefixListMetaDto })
  meta!: BatchPrefixListMetaDto;

}

export class BatchPrefixSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Batch prefix deleted successfully' })
  message!: string;

  @ApiProperty({ type: BatchPrefixDeleteResultDto })
  data!: BatchPrefixDeleteResultDto;
}
