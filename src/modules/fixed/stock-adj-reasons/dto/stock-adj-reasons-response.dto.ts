import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockAdjReasonsErrorFieldDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;
}

export class StockAdjReasonsErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: StockAdjReasonsErrorFieldDto, isArray: true })
  errors!: StockAdjReasonsErrorFieldDto[];
}

export class StockAdjReasonsPayloadDto {
  @ApiProperty({ example: '01930000-0000-7000-0000-000000000001' })
  sarId!: string;

  @ApiProperty({ example: 'DAMAGE' })
  sarCode!: string;

  @ApiProperty({ example: 'Physical Damage' })
  sarName!: string;

  @ApiProperty({ example: 'LOSS' })
  sarReasonKind!: string;

  @ApiProperty({ example: 'WRITE_OFF' })
  sarDefaultResolution!: string;

  @ApiProperty({ example: true })
  sarAffectsAccounts!: boolean;

  @ApiProperty({ example: true })
  sarIsActive!: boolean;

  @ApiProperty({ example: false })
  sarIsDeleted!: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  sarCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  sarCreatedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  sarModifiedOn!: string | null;

  @ApiPropertyOptional({ nullable: true, example: null })
  sarModifiedBy!: string | null;
}

export class StockAdjReasonsGetMetaDto {
  @ApiPropertyOptional({ example: '01930000-0000-7000-0000-000000000001' })
  sarId?: string;

  @ApiPropertyOptional({ example: 'DAMAGE' })
  sarCode?: string;

  @ApiPropertyOptional({ example: 'LOSS' })
  sarReasonKind?: string;

  @ApiProperty({ example: true })
  activeOnly!: boolean;

  @ApiProperty({ example: false })
  includeDeleted!: boolean;

  @ApiProperty({ example: 5 })
  count!: number;
}

export class StockAdjReasonsSuccessGetDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Stock adjustment reasons fetched successfully' })
  message!: string;

  @ApiProperty({ type: StockAdjReasonsPayloadDto, isArray: true })
  data!: StockAdjReasonsPayloadDto[];

  @ApiProperty({ type: StockAdjReasonsGetMetaDto })
  meta!: StockAdjReasonsGetMetaDto;
}
