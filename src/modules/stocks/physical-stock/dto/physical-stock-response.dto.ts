import { ApiProperty } from '@nestjs/swagger';

export class PhysicalStockErrorResponseDto {
  @ApiProperty({
    example: false,
    description: 'Request success status',
  })
  success!: false;

  @ApiProperty({
    example: 'Validation failed',
    description: 'Error message',
  })
  message!: string;

  @ApiProperty({
    example: 400,
    description: 'HTTP status code',
  })
  statusCode!: number;

  @ApiProperty({
    example: [
      'psDocNo must be a number',
      'psGodownId should not be empty',
    ],
    required: false,
    description: 'Validation error details',
    type: [String],
  })
  errors?: string[];
}