import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HsnCodeMasterErrorFieldDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;
}

export class HsnCodeMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: HsnCodeMasterErrorFieldDto, isArray: true })
  errors!: HsnCodeMasterErrorFieldDto[];
}

export class HsnCodeMasterPayloadDto {
  @ApiProperty({ example: 1 })
  hsnId!: number;

  @ApiProperty({ example: '3004' })
  hsnCode!: string;

  @ApiProperty({ example: 'Medicaments' })
  hsnName!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Ayurvedic medicine' })
  hsnDescription!: string | null;

  @ApiProperty({ example: false })
  hsnIsService!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'PCS' })
  hsnUqc!: string | null;

  @ApiProperty({ example: true })
  hsnIsActive!: boolean;

  @ApiProperty({ example: 18 })
  hsnRateOfTax!: number;
}

export class HsnCodeMasterGetMetaDto {
  @ApiPropertyOptional({ example: 1 })
  hsnId?: number;

  @ApiPropertyOptional({ example: '3004' })
  hsnCode?: string;

  @ApiProperty({ example: true })
  activeOnly!: boolean;

  @ApiProperty({ example: 3 })
  count!: number;
}

export class HsnCodeMasterSuccessGetDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'HSN codes fetched successfully' })
  message!: string;

  @ApiProperty({ type: HsnCodeMasterPayloadDto, isArray: true })
  data!: HsnCodeMasterPayloadDto[];

  @ApiProperty({ type: HsnCodeMasterGetMetaDto })
  meta!: HsnCodeMasterGetMetaDto;
}
