import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BankListErrorFieldDto {
  @ApiProperty({ example: 'bnkName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate bank name is not allowed' })
  message!: string;
}

export class BankListErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: BankListErrorFieldDto, isArray: true })
  errors!: BankListErrorFieldDto[];
}

export class BankListPayloadDto {
  @ApiProperty({ format: 'uuid' })
  bnkId!: string;

  @ApiProperty({ maxLength: 200 })
  bnkName!: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  bnkShortName!: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  bnkAlias!: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  bnkRbiCode!: string | null;

  @ApiProperty({ example: false })
  bnkIbanSupported!: boolean;

  @ApiProperty({ example: true })
  bnkIsActive!: boolean;

  @ApiProperty({ example: false })
  bnkIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  bnkSyncDate!: string | null;

  @ApiProperty()
  bnkCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  bnkCreatedBy!: string | null;

  @ApiProperty()
  bnkModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  bnkModifiedBy!: string | null;
}

export class BankListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class BankListDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  bnkId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class BankListSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Bank fetched successfully' })
  message!: string;

  @ApiProperty({ type: BankListPayloadDto })
  data!: BankListPayloadDto;
}

export class BankListSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Banks fetched successfully' })
  message!: string;

  @ApiProperty({ type: BankListPayloadDto, isArray: true })
  data!: BankListPayloadDto[];

  @ApiProperty({ type: BankListMetaDto })
  meta!: BankListMetaDto;
}

export class BankListSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Bank deleted successfully' })
  message!: string;

  @ApiProperty({ type: BankListDeleteResultDto })
  data!: BankListDeleteResultDto;
}
