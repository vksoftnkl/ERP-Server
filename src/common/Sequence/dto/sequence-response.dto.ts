import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SequenceErrorFieldDto {
  @ApiProperty({ example: 'scope' })
  field!: string;

  @ApiProperty({
    example:
      'Duplicate vchrTypeId, companyId, branchId, accYear, deviceCode, and periodKey values are not allowed',
  })
  message!: string;
}

export class SequenceErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: SequenceErrorFieldDto, isArray: true })
  errors!: SequenceErrorFieldDto[];
}

export class SequencePayloadDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  vchrTypeId!: number;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ example: '2026-27' })
  accYear!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  deviceId!: string | null;

  @ApiProperty({ example: 'MAIN' })
  deviceCode!: string;

  @ApiProperty({ example: '2026-27' })
  periodKey!: string;

  @ApiProperty({ example: '1', description: 'Server-generated next number for the sequence scope' })
  lastNo!: string;

  @ApiPropertyOptional({ nullable: true })
  voucherPrefix!: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  branchCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  voucherSuffix!: string | null;

  @ApiProperty({ example: 5 })
  noWidth!: number;

  @ApiPropertyOptional({ nullable: true })
  lastRefno!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiProperty()
  createdOn!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  modifiedOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  modifiedBy!: string | null;
}

export class SequenceListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class SequenceDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class SequenceSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sequence fetched successfully' })
  message!: string;

  @ApiProperty({ type: SequencePayloadDto })
  data!: SequencePayloadDto;
}

export class SequenceSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sequences fetched successfully' })
  message!: string;

  @ApiProperty({ type: SequencePayloadDto, isArray: true })
  data!: SequencePayloadDto[];

  @ApiProperty({ type: SequenceListMetaDto })
  meta!: SequenceListMetaDto;
}

export class SequenceSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sequence deleted successfully' })
  message!: string;

  @ApiProperty({ type: SequenceDeleteResultDto })
  data!: SequenceDeleteResultDto;
}
