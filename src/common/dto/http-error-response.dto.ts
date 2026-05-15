import { ApiProperty } from '@nestjs/swagger';
export class HttpErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 400 })
  statusCode!: number;
  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Bad Request' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email'],
      },
      {
        type: 'object',
        additionalProperties: true,
      },
    ],
  })
  message!: unknown;
  @ApiProperty({ example: '/api/v1/users' })
  path!: string;
  @ApiProperty({ example: '2026-02-12T14:32:10.123Z' })
  timestamp!: string;
}