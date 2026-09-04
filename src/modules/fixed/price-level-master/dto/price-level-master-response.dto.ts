import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class PriceLevelMasterErrorFieldDto {
  @ApiProperty()
  field!: string;
  @ApiProperty()
  message!: string;
}
export class PriceLevelMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: PriceLevelMasterErrorFieldDto, isArray: true })
  errors!: PriceLevelMasterErrorFieldDto[];
}
export class PriceLevelMasterPayloadDto {
  @ApiProperty({ example: 1 })
  priceLvlId!: number;
  @ApiProperty({ example: 'Retail' })
  priceLvlName!: string;
  @ApiPropertyOptional({ example: 'RTL', nullable: true })
  priceLvlShort!: string | null;
  @ApiProperty({ example: true })
  priceLvlIsActive!: boolean;
  @ApiProperty({ example: false })
  priceLvlIsAdmin!: boolean;
  @ApiProperty({ example: false })
  priceLvlIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, example: '2026-03-01T10:20:00.000Z' })
  priceLvlSyncDate!: string | null;
  @ApiProperty({ example: '2026-03-01T10:20:00.000Z' })
  priceLvlCreatedOn!: string;
  @ApiPropertyOptional({ nullable: true, example: 'system' })
  priceLvlCreatedBy!: string | null;
  @ApiProperty({ example: '2026-03-01T10:20:00.000Z' })
  priceLvlModifiedOn!: string;
  @ApiPropertyOptional({ nullable: true, example: 'system' })
  priceLvlModifiedBy!: string | null;
}
export class PriceLevelMasterGetMetaDto {
  @ApiPropertyOptional({ example: 1 })
  priceLvlId?: number;
  @ApiPropertyOptional({ example: true })
  priceLvlIsActive?: boolean;
  @ApiProperty({ example: false })
  includeDeleted!: boolean;
  @ApiProperty({ example: 3 })
  count!: number;
}
export class PriceLevelMasterSuccessGetDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Price levels fetched successfully' })
  message!: string;
  @ApiProperty({ type: PriceLevelMasterPayloadDto, isArray: true })
  data!: PriceLevelMasterPayloadDto[];
  @ApiProperty({ type: PriceLevelMasterGetMetaDto })
  meta!: PriceLevelMasterGetMetaDto;
}

export class PriceLevelMasterSuccessUpdateDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Price levels updated successfully' })
  message!: string;
  @ApiProperty({ type: PriceLevelMasterPayloadDto, isArray: true })
  data!: PriceLevelMasterPayloadDto[];
}