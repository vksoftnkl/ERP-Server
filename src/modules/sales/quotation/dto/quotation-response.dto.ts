import { ApiProperty } from '@nestjs/swagger';

export class QuotationErrorFieldDto {
  @ApiProperty({ example: 'sqQuoteRefno' })
  field!: string;

  @ApiProperty({ example: 'Duplicate quotation reference number is not allowed' })
  message!: string;
}

export class QuotationErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: QuotationErrorFieldDto, isArray: true })
  errors!: QuotationErrorFieldDto[];
}

export class QuotationDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  sqId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class QuotationSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Quotation fetched successfully' })
  message!: string;

  @ApiProperty({ description: 'Quotation record including its line items' })
  data!: Record<string, unknown>;
}

export class QuotationSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Quotation deleted successfully' })
  message!: string;

  @ApiProperty({ type: QuotationDeleteResultDto })
  data!: QuotationDeleteResultDto;
}
